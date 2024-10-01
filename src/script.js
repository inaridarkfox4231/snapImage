/*
  細部めちゃくちゃだけどまあ形にはなってるわね...
  課題
  切り替えをわかりやすく
  スマホでもできるように
  フォント選べるように
  背景設定できるように（せめてグラデくらいは...グラデくらいは...）
  以上。別にフィルタとかは要らないです。
  欲を言えばブラシでお絵描き出来たらいいけどあんま贅沢言ってもねぇ

  追加で画像を用意してmainFrameの上におくとかできたら便利かも
  切り取るんじゃなくて単純はりつけの形だけど
  QRを置いたりとか、他の写真を並べたりなんて使い方ができるはず
  色々可能だと思うにょ
  変更点としては
  まずファイルタグを破棄しない
  で
  追加画像をmainとsubの間に挿入していく
  それもいじれるようにする（FrameRect）
  んでrender()を用意
  これ使ってmainFrameのサイズ準拠でそこに落としていく

  2024/09/30
  1.11.0ですって
  わぁお

  fontいろいろ導入
  あと改行ですねこれの対応
  取得部分いじればいいですね
*/

// innerWidthは危険 https://web-guided.com/1376/#google_vignette
// ちなみにp5の組み込み変数windowWidthの規定値はinnerWidthです（heightも同様）
// なぜ危険かというと答えは簡単でpixelDensityを反映するからですね
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;

let TC;

let fonts = {'sans-serif':"sans-serif"};

function preload(){
  fonts.mincho = loadFont("https://inaridarkfox4231.github.io/assets/HannariMincho-Regular.otf");
  fonts.hui = loadFont("https://inaridarkfox4231.github.io/assets/HuiFont29.ttf");
  fonts.kosugimaru = loadFont("https://inaridarkfox4231.github.io/assets/KosugiMaru-Regular.ttf");
}

let config = {
  content:"text",
  size:40,
  col:{r:255,g:255,b:255},
  alphaValue:255,
  x:0,
  y:0,
  alignV:"left",
  alignH:"top",
  fontType:"sans-serif",
  fitW:1,
  fitH:1,
  saveName:"",
  saveRatio:1
};

const controllers = {};

function createGUI(){
  const gui = new lil.GUI();
  gui.add({fun:()=>{
    switchTarget();
  }},'fun').name('switchTarget');
  gui.add({fun:()=>{
    switchController();
  }},'fun').name('switchController');
  controllers.content = gui.add(config, "content").onChange(
    (value) => {TC.modifyTextObject("content", value);}
  );
  controllers.x = gui.add(config, "x", 0, CANVAS_WIDTH, 1).onChange(
    (value) => {TC.modifyTextObject("x", value);}
  );
  controllers.y = gui.add(config, "y", 0, CANVAS_HEIGHT, 1).onChange(
    (value) => {TC.modifyTextObject("y", value);}
  );
  controllers.size = gui.add(config, "size", 10, 320, 1).onChange(
    (value) => {TC.modifyTextObject("size", value);}
  );
  controllers.col = gui.addColor(config, "col", 255).onChange(
    (value) => {TC.modifyTextObject("col", value);}
  );
  controllers.alphaValue = gui.add(config, "alphaValue",0,255,1).onChange(
    (value) => {TC.modifyTextObject("alphaValue", value);}
  );
  controllers.alignV = gui.add(config, "alignV", ["left","center","right"]).onChange(
    (value) => {TC.modifyTextObject("alignV", value);}
  );
  controllers.alignH = gui.add(config, "alignH", ["top","center","bottom"]).onChange(
    (value) => {TC.modifyTextObject("alignH", value);}
  );
  controllers.fontType = gui.add(config, "fontType", ['sans-serif', 'mincho', 'hui', 'kosugimaru']).onChange(
    (value) => {TC.modifyTextObject("fontType", value);}
  )
  gui.add({fun:()=>TC.addTextObject(new TextObject())}, 'fun').name('addText');
  gui.add({fun:()=>{TC.removeTextObject()}}, 'fun').name('removeText');

  gui.add(config, "fitW", 0.1, 2, 0.05).onChange(
    (value) => {fitting(value, config.fitH);}
  );
  gui.add(config, "fitH", 0.1, 2, 0.05).onChange(
    (value) => {fitting(config.fitW, value);}
  );
  gui.add({fun:()=>{
    fitting(1, 1);
  }}, 'fun').name('fit');
  gui.add(config, "saveName");
  gui.add(config, "saveRatio", 0.01, 1, 0.01);
  gui.add({fun:()=>{
    saveRegion(config.saveName, config.saveRatio);
  }}, 'fun').name('save');
  gui.close();
}

// 関数化は一旦見送り
// いろいろ実験しないといけない
// まず
// text, json, gltfなどのデータでやるとどうなる、とか。
// 複数の場合はどうする、とか
// readAsDataURLは画像の場合はいいけど他の場合はどうなるんだろうとか
// ArrayBufferってなんだろうな AudioContextの方でなんかそういうのあったか？
// webAudioAPIも詳しくなって音声とかもやりたい（できるのかなぁ）
// gltfねぇ...

const fileTag = document.createElement("input");
fileTag.setAttribute("id", "file");
fileTag.setAttribute("type", "file");
fileTag.style.width = "180px";
fileTag.style.height = "40px";
// これで複数選択できるようになる
// Ctrlで複数クリックした後でEnterキーを押せば完了する（今回は不要...）
//fileTag.setAttribute("multiple", "");

let loadedImg;
let FC;
let mainFrame, subFrame;

// どこにも属していなくても、対象を特定できさえすれば、
// イベントリスナーを登録できるみたい。
fileTag.addEventListener("change", function (e) {
  const file = e.target.files;
  const reader = new FileReader();
  // ファイルが無かった場合は何もしない。
  if(file.length===0) return;

  //ファイルが複数読み込まれた際に、1つめを選択
  reader.readAsDataURL(file[0]);

  //ファイルが読み込めたら
  reader.onload = function () {
    const src = reader.result;
    initializeFrameController(src);
    // 読み込んだらこの要素は破棄する。
    fileTag.remove();
  };
}, false);

function initializeFrameController(source){
  const img = new Image();
  img.src = source;

  img.onload = function () {
    const w = img.width;
    const h = img.height;
    loadedImg = createGraphics(w, h);
    loadedImg.drawingContext.drawImage(img, 0, 0);
    // これでloadedImgができる。これを元にmainFrameを構成する。
    // デフォルトスケールの計算

    const wScale = CANVAS_WIDTH / w;
    const hScale = CANVAS_HEIGHT / h;
    const s = Math.min(wScale, hScale);
    mainFrame = new FrameRect({
      x:0, y:0, w:w, h:h,
      defaultScale:s, maxScale:s*4, minScale:s*0.25,
      img:loadedImg
    });
    subFrame = new FrameRect({
      x:0, y:0, w:w*s, h:h*s,
      defaultScale:0.5, maxScale:2, minScale:0.1
    });
    const canvas = document.getElementById("defaultCanvas0");
    FC = new FrameController(canvas, {frames:[
      mainFrame, subFrame
    ]});
  };
}

function setup() {
  createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  pixelDensity(1);

  createGUI();

  // gh-pagesの自動サイズ変更の対抗策
  const lil = document.getElementsByClassName("lil-gui root allow-touch-styles autoPlace closed")[0];
  lil.style.width = Math.floor(width/2) + "px";
  lil.style.resize = "none";
  const textBoxDOM = document.getElementsByTagName("input")[0];
  textBoxDOM.style.fontSize = "18px";
  textBoxDOM.style.resize = "none";
  const saveNameBoxDOM = document.getElementsByTagName("input")[9];
  saveNameBoxDOM.style.fontSize = "18px";
  saveNameBoxDOM.style.resize = "none";

  TC = new TextController(this.canvas);

  // 文字入力中はコンフィグにフォーカスしているので
  // キーアクションは発動しないようです。よかったね。
  const KA = new foxIA.KeyAction(this.canvas);
  KA.registAction("ShiftLeft",{activate:()=>{
    switchTarget();
  }});
  // 保存
  KA.registAction("KeyS",{activate:()=>{
    saveRegion(config.saveName, config.saveRatio);
  }});
  // fitが無いと不便だと思う
  // 元の画像をそのままいじりたい場合に（文字を乗せるだけとか）
  // configでもいじれるようにしよう
  KA.registAction("KeyF",{activate:()=>{
    // fit
    fitting(1, 1);
  }});
  // 雑（まじめにやれ）
  KA.registAction("KeyG", {activate:()=>{
    switchController();
  }});

  // configにwとhのratioみたいな枠を設けて
  // 1とか0.7とか指定できるといい
  // そのサイズで初期化される(0.1～2で0.1刻み)

  noFill();
  strokeWeight(3);

  // あとから配置を決める。
  document.getElementById("defaultCanvas0").before(fileTag);
  const cvs = document.getElementById("defaultCanvas0");
  cvs.style.width = window.innerWidth+"px";
  cvs.style.height = window.innerHeight+"px";
}

function draw() {
  background(220);

  push();
  fill(0);
  noStroke();
  textSize(12);
	textAlign(LEFT,TOP);
	text("width:"+width,5,5);
	text("windowWidth:"+windowWidth,5,35);
	text("window.innerWidth:"+window.innerWidth,5,65);
	text("window.screen.width:"+window.screen.width,5,95);
	text("height:"+height,5,145);
	text("windowHeight:"+windowHeight,5,175);
	text("window.innerHeight:"+window.innerHeight,5,205);
	text("window.screen.height:"+window.screen.height,5,235);
	text("devicePixelRatio:"+window.devicePixelRatio,5,285);

  text("情報", 5, 335);
  pop();

  if(loadedImg === undefined){ return; }
  background(220);

  FC.update();
  FC.display(this);

  TC.displayTextObjects(this);
}

// fitの別バージョン(0.1～2で0.1刻み)
function fitting(ratioW = 1, ratioH = 1){
  // fit
  subFrame.x = mainFrame.x;
  subFrame.y = mainFrame.y;
  subFrame.scaleValue = 1;
  subFrame.w = mainFrame.w*mainFrame.scaleValue*ratioW;
  subFrame.h = mainFrame.h*mainFrame.scaleValue*ratioH;
}

// 操作対象切り替え
function switchTarget(){
  if(FC.isActive){
    FC.switchFrame();
  }else if(TC.isActive){
    TC.switchTextObject();
  }
}

// コントローラー切り替え
function switchController(){
  if(FC.isActive){
    FC.inActivate(); TC.activate(); return;
  }
  FC.activate(); TC.inActivate();
}

class FrameController extends foxIA.Interaction{
  constructor(canvas, options = {}){
    super(canvas, options);

    this.frames = [];
    this.currentFrame = null;
    this.channel = 0;
    const {frames = []} = options;
    this.frames.push(...frames);

    if(this.frames.length > 0){
      this.currentFrame = this.frames[0];
      this.frames[0].captured();
    }
    this.isActive = true;
    this.isDragging = false;
  }
  activate(){
    this.isActive = true;
    this.frames[this.channel].captured();
  }
  inActivate(){
    this.isActive = false;
    for(const frame of this.frames){
      frame.released();
    }
  }
  getChannel(){
    return this.channel;
  }
  switchFrame(){
    this.currentFrame.released();
    this.channel = (this.channel+1)%this.frames.length;
    this.currentFrame = this.frames[this.channel];
    this.currentFrame.captured();
  }
  update(){
    this.currentFrame.update();
  }
  display(target){
    //const ch = this.channel;
    //target.push();
    //if(ch===0){target.stroke("darkred")}else{target.stroke("red")}
    this.frames[0].displayImg(target);
    this.frames[1].display(target);
    //target.pop();
  }
  calcMousePosition(e){
    return {
      x:e.clientX - this.rect.left,
      y:e.clientY - this.rect.top
    };
  }
  mouseDownDefaultAction(e){
    if(!this.isActive)return;
    const c = this.calcMousePosition(e);
    if(this.currentFrame.hit(c.x, c.y)){
      this.isDragging = true;
    }
  }
  mouseMoveDefaultAction(dx, dy, x, y){
    if(!this.isActive)return;
    if(!this.isDragging)return;
    this.currentFrame.slide(dx, dy);
  }
  mouseUpDefaultAction(){
    if(!this.isActive)return;
    this.isDragging = false;
  }
  wheelAction(e){
    if(!this.isActive)return;
    const c = this.calcMousePosition(e);
    this.currentFrame.setCenter(c.x, c.y);
    this.currentFrame.addForceToScaleSpeed(-e.deltaY*0.0003);
  }
  touchStartDefaultAction(e){
    if(!this.isActive)return;
    const p = this.pointers[0];
    if(this.currentFrame.hit(p.x, p.y)){
      this.isDragging = true;
    }
  }
  touchSwipeAction(dx, dy, x, y, px, py){
    if(!this.isActive)return;
    if(!this.isDragging)return;
    this.currentFrame.slide(dx, dy);
  }
  touchPinchInOutAction(diff, ratio, x, y, px, py){
    if(!this.isActive)return;
    this.currentFrame.setCenter(x, y);
    this.currentFrame.addForceToScaleSpeed(diff*0.0003);
  }
  touchEndDefaultAction(){
    if(!this.isActive)return;
    this.isDragging = false;
  }
}

class FrameRect{
  constructor(params = {}){
    this.center = createVector(0,0);
    const {
      x = 0, y = 0, w = 100, h = 100,
      defaultScale = 1, maxScale = 1, minScale = 1,
      dumpingCoefficient = 0.85, img = null
    } = params;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.scaleValue = defaultScale;
    this.scaleSpeed = 0;
    this.maxScale = maxScale;
    this.minScale = minScale;
    this.dumpingCoefficient = dumpingCoefficient;
    this.img = img;
    this.isSelected = false;
  }
  captured(){
    this.isSelected = true;
  }
  released(){
    this.isSelected = false;
  }
  getRectData(){
    return {
      x:this.x, y:this.y, w:this.w, h:this.h, s:this.scaleValue
    };
  }
  setCenter(x, y){
    this.center.set(x, y);
  }
  hit(x, y){
    const w = this.w * this.scaleValue;
    const h = this.h * this.scaleValue;
    return (x>=this.x)&&(x<=this.x+w)&&(y>=this.y)&&(y<=this.y+h);
  }
  setImg(img){
    this.img = img;
  }
  getImg(){
    return this.img;
  }
  slide(dx,dy){
    this.x += dx;
    this.y += dy;
  }
  update(){
    const prevScaleValue = this.scaleValue;
    this.scaleValue *= Math.pow(2, this.scaleSpeed);
    this.scaleValue = Math.max(this.minScale, Math.min(this.maxScale,this.scaleValue));
    const scaleRatio = this.scaleValue/prevScaleValue;
    this.x = this.center.x + (this.x - this.center.x)*scaleRatio;
    this.y = this.center.y + (this.y - this.center.y)*scaleRatio;
    this.scaleSpeed *= this.dumpingCoefficient;
    if(Math.abs(this.scaleSpeed)<0.0001){
      this.scaleSpeed = 0;
    }
  }
  addForceToScaleSpeed(f){
    this.scaleSpeed += f;
  }
  display(target){
    target.push();
    target.strokeWeight(3);
    target.noFill();
    if(this.isSelected){
      target.stroke("red");
    }else{
      target.stroke("darkred");
    }
    target.rect(this.x, this.y, this.w*this.scaleValue, this.h*this.scaleValue);
    target.pop();
  }
  displayImg(target){
    if(this.img === null) return;
    target.push();
    target.image(
      this.img, this.x, this.y,
      this.w*this.scaleValue,this.h*this.scaleValue,
      0, 0, this.img.width, this.img.height
    );
    if(!this.isSelected){
      target.noStroke();
      target.fill(0,128);
      target.rect(this.x, this.y, this.w*this.scaleValue, this.h*this.scaleValue);
    }
    target.pop();
  }
}

// (x,y)を左上とし、(w,h)のサイズを切り取る。これはmainFrameのサイズに
// 準拠している。
function calcRegion(){
  const mf = mainFrame.getRectData();
  const sf = subFrame.getRectData();
  const w = sf.w * sf.s / mf.s;
  const h = sf.h * sf.s / mf.s;
  const x = (sf.x - mf.x) / mf.s;
  const y = (sf.y - mf.y) / mf.s;
  let left = constrain(x, 0, mf.w);
  let right = constrain(x+w, 0, mf.w);
  let top = constrain(y, 0, mf.h);
  let bottom = constrain(y+h, 0, mf.h);
  return {x,y,w,h,left,right,top,bottom};
}

// saveRatioは縮小の度合い
// 場合によっては小さい方がいい場合もあるでしょうから
function saveRegion(saveName, saveRatio = 1){
  const rg = calcRegion();
  // 空っぽの場合は自動的に用意される
  if(saveName === ""){
    saveName = "region_" + frameCount;
  }
  const saveGraphic = createGraphics(rg.w*saveRatio, rg.h*saveRatio);
  saveGraphic.background(0); // ここはいろいろいじれるように...？
  const img = mainFrame.getImg();
  saveGraphic.image(
    img, (rg.left-rg.x)*saveRatio, (rg.top-rg.y)*saveRatio, (rg.right-rg.left)*saveRatio, (rg.bottom-rg.top)*saveRatio,
    rg.left, rg.top, rg.right-rg.left, rg.bottom-rg.top
  );
  // テキストを落とす？
  for(const obj of TC.textObjects){
    obj.render(saveGraphic, subFrame, mainFrame.scaleValue/saveRatio);
  }

  saveGraphic.save(saveName);
}

// 改行処理の関数
function applyLineBreak(txt){
  const splittedText = txt.split('\\n');
  if(splittedText.length === 1){
    return txt;
  }
  const resultText = splittedText.reduce((s0, s1) => s0.concat('\n').concat(s1));
  return resultText;
}

class TextObject{
  constructor(params = {}){
    const {
      content = "text", initialSize = 40, x = 0, y = 0,
      alignV="left", alignH="top", fontType = 'sans-serif',
      col={r:255,g:255,b:255}, alphaValue = 255
    } = params;
    this.content = content;
    this.size = initialSize;
    this.x = x;
    this.y = y;
    this.alignV = alignV;
    this.alignH = alignH;
    this.fontType = fontType;
    this.col = col;
    this.alphaValue = alphaValue;
    this.active = false;
  }
  activate(){
    this.active = true;
    for(const name of ["x","y","content","alignV","alignH","fontType","size","col","alphaValue"]){
      if(name !== "col"){
        config[name] = this[name];
        controllers[name].updateDisplay();
      }else{
        config.col = {r:this.col.r, g:this.col.g, b:this.col.b};
        controllers.col.updateDisplay();
      }
    }
  }
  inActivate(){
    this.active = false;
  }
  slide(dx, dy){
    this.x += dx;
    this.y += dy;
    // 離散化
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
  }
  modify(name, content){
    if(!["x","y","content","alignV","alignH","fontType","size","col","alphaValue"].includes(name)) return;
    // x,y,content,alignV,alignH,size
    if(name !== "col"){
      if(name === 'content'){
        this.content = applyLineBreak(content);
      }else{
        this[name] = content;
      }
    }else{
      this.col = {r:content.r, g:content.g, b:content.b};
    }
  }
  addForce(force){
    this.scaleVelocity += force;
  }
  display(target){
    target.push();
    target.noStroke();
    target.textFont(fonts[this.fontType]);
    target.textSize(this.size);
    target.textAlign(this.alignV, this.alignH);
    const factor = (this.active ? 0.4+0.3*Math.cos(frameCount*TAU/120) : 1);
    target.fill(this.col.r, this.col.g, this.col.b, this.alphaValue*factor);
    target.text(this.content, this.x, this.y);
    target.pop();
  }
  render(target, targetFrame, mfScale){
    target.push();
    const x = (this.x-targetFrame.x)/mfScale;
    const y = (this.y-targetFrame.y)/mfScale;
    target.noStroke();
    target.textFont(fonts[this.fontType]);
    target.textSize(this.size/mfScale);
    target.textAlign(this.alignV, this.alignH);
    target.fill(this.col.r, this.col.g, this.col.b, this.alphaValue);
    target.text(this.content, x, y);
    target.pop();
  }
}

class TextController extends foxIA.Interaction{
  constructor(canvas, options = {}){
    super(canvas, options);
    this.textObjects = [];
    this.currentId = -1;
    this.currentTextObject = null;
    this.isActive = true;
    this.isDragging = false;
  }
  activate(){
    this.isActive = true;
    this.textObjects[this.currentId].activate();
  }
  inActivate(){
    this.isActive = false;
    for(const obj of this.textObjects){
      obj.inActivate();
    }
  }
  addTextObject(params = {}){
    this.textObjects.push(new TextObject(params));
    if(this.textObjects.length === 1){
      this.currentTextObject = this.textObjects[0];
      this.currentTextObject.activate();
      this.currentId = 0;
    }
  }
  removeTextObject(){
    if(this.textObjects.length === 0) return;
    this.textObjects.splice(this.currentId,1);
    if(this.textObjects.length>0){
      this.currentId = Math.min(this.textObjects.length-1, this.currentId);
      this.currentTextObject = this.textObjects[this.currentId];
      this.currentTextObject.activate();
    }else{
      this.currentId = -1;
      this.currentTextObject = null;
    }
  }
  switchTextObject(){
    if(this.currentId < 0)return;
    this.currentTextObject.inActivate();
    this.currentId = (this.currentId+1)%this.textObjects.length;
    this.currentTextObject = this.textObjects[this.currentId];
    this.currentTextObject.activate();
  }
  modifyTextObject(name, content){
    if(this.textObjects.length === 0) return;
    this.currentTextObject.modify(name, content);
  }
  displayTextObjects(target){
    for(const obj of this.textObjects){
      obj.display(target);
    }
  }
  mouseDownDefaultAction(e){
    if(!this.isActive)return;
    if(this.textObjects.length === 0) return;
    this.isDragging = true;
  }
  mouseMoveDefaultAction(dx, dy, x, y){
    if(!this.isActive)return;
    if(this.textObjects.length === 0) return;
    if(!this.isDragging)return;
    this.currentTextObject.slide(dx, dy);
    config.x = this.currentTextObject.x;
    config.y = this.currentTextObject.y;
    controllers.x.updateDisplay();
    controllers.y.updateDisplay();
  }
  mouseUpDefaultAction(){
    if(!this.isActive)return;
    this.isDragging = false;
  }
  touchStartDefaultAction(){
    if(!this.isActive)return;
    if(this.textObjects.length === 0) return;
    this.isDragging = true;
  }
  touchSwipeAction(dx, dy, x, y, px, py){
    if(!this.isActive)return;
    if(this.textObjects.length === 0) return;
    if(!this.isDragging)return;
    this.currentTextObject.slide(dx, dy);
    config.x = this.currentTextObject.x;
    config.y = this.currentTextObject.y;
    controllers.x.updateDisplay();
    controllers.y.updateDisplay();
  }
  touchEndDefaultAction(){
    if(!this.isActive)return;
    this.isDragging = false;
  }
}
