import { Application, Container, Sprite, Assets, Text, TextStyle, Graphics } from 'pixi.js';
import gsap from 'gsap';

const app = new Application();

const VIRTUAL_WIDTH = 1280;
const VIRTUAL_HEIGHT = 760;

const TOTAL_BARRELS = 20;
const RTP = 0.97;

let balance = 1000.0;
let betAmount = 10;
let trapsCount = 3;
let revealedCount = 0;
let isRoundActive = false;
let isGameOver = false;

interface BarrelEntity {
  id: number;
  container: Container;
  closedSprite: Sprite;
  goldSprite: Sprite;
  trapSprite: Sprite;
  tentacleSprite: Sprite;
  baseRotation: number;
  isTrap: boolean;
  isRevealed: boolean;
}

const barrels: BarrelEntity[] = [];
const trapsIndices: Set<number> = new Set();
const rootContainer = new Container();

let krakenNormal: Sprite;
let krakenAngry: Sprite;
let krakenBaseScale = 0.5;
let krakenAngryScale = 0.46;

let balanceValText: Text;
let betErrorText: Text;
let minesValText: Text;
let baseMultText: Text;
let profitValText: Text;
let mainActionBtn: Container;
let mainActionText: Text;
let btnBg: Graphics;
let waterOverlay: Graphics;
let fxLayer: Container;

let betInputElement: HTMLInputElement;

async function init() {
  await app.init({
    resizeTo: window,
    backgroundColor: 0x05040a,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  document.body.appendChild(app.canvas);
  app.stage.addChild(rootContainer);

  const textures = await Assets.load([
    '/assets/background.png',
    '/assets/kraken.png',
    '/assets/kraken_angry.png',
    '/assets/tentacles1.png',
    '/assets/tentacles2.png',
    '/assets/tentacles3.png',
    '/assets/tentacles4.png',
    '/assets/barrel_closed.png',
    '/assets/barrel_gold.png',
    '/assets/barrel_trap.png',
  ]);

  const bgContainer = new Container();
  const waterContainer = new Container();
  const tentaclesLayer = new Container();
  const krakenLayer = new Container();
  const barrelsContainer = new Container();
  fxLayer = new Container();
  const uiContainer = new Container();

  rootContainer.addChild(bgContainer);
  rootContainer.addChild(waterContainer);
  rootContainer.addChild(tentaclesLayer);
  rootContainer.addChild(krakenLayer);
  rootContainer.addChild(barrelsContainer);
  rootContainer.addChild(fxLayer);
  rootContainer.addChild(uiContainer);

  // Фон
  const bgSprite = Sprite.from(textures['/assets/background.png']);
  bgSprite.width = VIRTUAL_WIDTH;
  bgSprite.height = VIRTUAL_HEIGHT;
  bgContainer.addChild(bgSprite);

  // Водна аура
  waterOverlay = new Graphics().rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: 0x9d174d, alpha: 0.03 });
  waterContainer.addChild(waterOverlay);
  gsap.to(waterOverlay, { alpha: 0.07, duration: 2.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });

  // Геометрія арени
  const fieldCenterX = 795;
  const fieldCenterY = 380;
  const radiusX = 430;
  const radiusY = 300;

  // Кракен
  krakenNormal = Sprite.from(textures['/assets/kraken.png']);
  krakenAngry = Sprite.from(textures['/assets/kraken_angry.png']);

  krakenBaseScale = 360 / krakenNormal.texture.width;
  krakenAngryScale = 335 / krakenAngry.texture.width;

  krakenNormal.anchor.set(0.5);
  krakenNormal.position.set(fieldCenterX, fieldCenterY);
  krakenNormal.scale.set(krakenBaseScale);

  krakenAngry.anchor.set(0.5);
  krakenAngry.position.set(fieldCenterX, fieldCenterY);
  krakenAngry.scale.set(krakenAngryScale);
  krakenAngry.visible = false;

  krakenLayer.addChild(krakenNormal, krakenAngry);

  gsap.to(krakenNormal.scale, {
    x: krakenBaseScale * 1.03,
    y: krakenBaseScale * 1.03,
    duration: 2.2,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  const tentacleTextures = [
    textures['/assets/tentacles1.png'],
    textures['/assets/tentacles2.png'],
    textures['/assets/tentacles3.png'],
    textures['/assets/tentacles4.png'],
  ];

  // 20 бочок та щупалець
  for (let i = 0; i < TOTAL_BARRELS; i++) {
    const angle = (i / TOTAL_BARRELS) * (Math.PI * 2) - Math.PI / 2;
    const bx = fieldCenterX + Math.cos(angle) * radiusX;
    const by = fieldCenterY + Math.sin(angle) * radiusY;

    const depthFactor = 0.9 + 0.15 * ((by - (fieldCenterY - radiusY)) / (radiusY * 2));

    const dx = fieldCenterX - bx;
    const dy = fieldCenterY - by;
    const dist = Math.hypot(dx, dy);
    const angleToKraken = Math.atan2(dy, dx) - Math.PI / 2;

    const chosenTentacleTex = tentacleTextures[i % tentacleTextures.length];
    const tentacle = Sprite.from(chosenTentacleTex);

    tentacle.anchor.set(0.5, 0.05);
    tentacle.position.set(bx, by);
    tentacle.rotation = angleToKraken;

    const scaleY = (dist / tentacle.texture.height) * 1.05;
    const scaleX = scaleY * 1.05;
    tentacle.scale.set(scaleX, scaleY);

    tentaclesLayer.addChild(tentacle);

    gsap.to(tentacle, {
      rotation: angleToKraken + Math.sin(i) * 0.04,
      duration: 1.6 + (i % 4) * 0.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    const bContainer = new Container();
    bContainer.position.set(bx, by);
    bContainer.zIndex = Math.floor(by);

    const naturalRotation = angle + Math.PI / 2 + Math.sin(i * 37) * 0.1;
    bContainer.rotation = naturalRotation;

    const closed = Sprite.from(textures['/assets/barrel_closed.png']);
    const gold = Sprite.from(textures['/assets/barrel_gold.png']);
    const trap = Sprite.from(textures['/assets/barrel_trap.png']);

    [closed, gold, trap].forEach((s) => {
      s.anchor.set(0.5);
      const targetScale = (82 / 1400) * depthFactor;
      s.scale.set(targetScale);
    });

    gold.visible = false;
    trap.visible = false;

    bContainer.addChild(closed, gold, trap);
    barrelsContainer.addChild(bContainer);

    const barrelEntity: BarrelEntity = {
      id: i,
      container: bContainer,
      closedSprite: closed,
      goldSprite: gold,
      trapSprite: trap,
      tentacleSprite: tentacle,
      baseRotation: naturalRotation,
      isTrap: false,
      isRevealed: false,
    };

    setupBarrelEvents(barrelEntity);
    barrels.push(barrelEntity);
  }

  barrelsContainer.sortableChildren = true;

  createSidebarUI(uiContainer);
  createHtmlBetInput();

  updateUI();

  window.addEventListener('resize', handleResize);
  handleResize();
}

function createHtmlBetInput() {
  betInputElement = document.createElement('input');
  betInputElement.type = 'number';
  betInputElement.className = 'bet-input';
  betInputElement.value = betAmount.toString();
  betInputElement.min = '1';

  betInputElement.addEventListener('input', () => {
    let val = parseFloat(betInputElement.value);

    if (isNaN(val) || val <= 0) {
      betAmount = 1;
      betErrorText.text = '';
      return;
    }

    if (val > balance) {
      val = balance;
      betInputElement.value = val.toString();
      betErrorText.text = 'Недостатньо коштів!';
      gsap.fromTo(betErrorText, { alpha: 1 }, { alpha: 0, delay: 2.5, duration: 0.5 });
    } else {
      betErrorText.text = '';
    }

    betAmount = Math.floor(val);
    updateUI();
  });

  document.body.appendChild(betInputElement);
}

function handleResize() {
  const screenW = app.screen.width;
  const screenH = app.screen.height;

  const scale = Math.min(screenW / VIRTUAL_WIDTH, screenH / VIRTUAL_HEIGHT);
  rootContainer.scale.set(scale);

  const rootX = (screenW - VIRTUAL_WIDTH * scale) / 2;
  const rootY = (screenH - VIRTUAL_HEIGHT * scale) / 2;
  rootContainer.x = rootX;
  rootContainer.y = rootY;

  if (betInputElement) {
    const inputX = rootX + 58 * scale;
    const inputY = rootY + 124 * scale;
    betInputElement.style.left = `${inputX}px`;
    betInputElement.style.top = `${inputY}px`;
    betInputElement.style.transform = `scale(${scale})`;
    betInputElement.style.transformOrigin = 'top left';
  }
}

function spawnGoldCoins(x: number, y: number) {
  const COIN_COUNT = 8;

  for (let i = 0; i < COIN_COUNT; i++) {
    const coin = new Graphics()
      .circle(0, 0, 6)
      .fill({ color: 0xffd15c })
      .stroke({ width: 1.5, color: 0xff9f1c });

    coin.position.set(x, y);
    fxLayer.addChild(coin);

    const angle = Math.random() * Math.PI * 2;
    const power = 40 + Math.random() * 50;
    const targetX = x + Math.cos(angle) * power;
    const targetY = y + Math.sin(angle) * power - 25;

    gsap.to(coin, {
      x: targetX,
      y: targetY,
      duration: 0.45,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(coin, {
          y: targetY + 35,
          alpha: 0,
          duration: 0.35,
          ease: 'power2.in',
          onComplete: () => {
            fxLayer.removeChild(coin);
            coin.destroy();
          },
        });
      },
    });
  }
}

function setupBarrelEvents(b: BarrelEntity) {
  b.container.eventMode = 'static';
  b.container.cursor = 'pointer';

  gsap.to(b.container, {
    rotation: b.baseRotation + 0.04,
    y: '+=2',
    duration: 1.8 + Math.random() * 0.5,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  b.container.on('pointerenter', () => {
    if (b.container.eventMode === 'static' && !b.isRevealed) {
      gsap.to(b.container.scale, { x: 1.1, y: 1.1, duration: 0.15 });
    }
  });

  b.container.on('pointerleave', () => {
    if (b.container.eventMode === 'static' && !b.isRevealed) {
      gsap.to(b.container.scale, { x: 1.0, y: 1.0, duration: 0.15 });
    }
  });

  b.container.on('pointertap', () => handleBarrelClick(b.id));
}

function calculateMultiplier(step: number, mines: number): number {
  if (step === 0) return 1.0;
  let mult = 1.0;
  for (let i = 0; i < step; i++) {
    const safeLeft = TOTAL_BARRELS - mines - i;
    const totalLeft = TOTAL_BARRELS - i;
    mult *= totalLeft / safeLeft;
  }
  return Number((mult * RTP).toFixed(2));
}

function startRound() {
  if (balance < betAmount) {
    betErrorText.text = 'Недостатньо коштів!';
    gsap.fromTo(betErrorText, { alpha: 1 }, { alpha: 0, delay: 2.5, duration: 0.5 });
    return;
  }

  balance -= betAmount;
  isRoundActive = true;
  isGameOver = false;
  revealedCount = 0;
  trapsIndices.clear();

  betInputElement.disabled = true;

  krakenNormal.visible = true;
  krakenAngry.visible = false;
  krakenNormal.scale.set(krakenBaseScale);

  while (trapsIndices.size < trapsCount) {
    trapsIndices.add(Math.floor(Math.random() * TOTAL_BARRELS));
  }

  barrels.forEach((b) => {
    b.isTrap = trapsIndices.has(b.id);
    b.isRevealed = false;
    b.closedSprite.visible = true;
    b.closedSprite.alpha = 1;
    b.goldSprite.visible = false;
    b.trapSprite.visible = false;
    b.tentacleSprite.alpha = 1;

    b.container.eventMode = 'static';
    b.container.cursor = 'pointer';
  });

  updateUI();
}

function cashOut() {
  if (!isRoundActive || revealedCount === 0) return;

  const mult = calculateMultiplier(revealedCount, trapsCount);
  balance += Number((betAmount * mult).toFixed(2));
  endGame(false);
}

function handleBarrelClick(id: number) {
  if (!isRoundActive || isGameOver) return;

  const b = barrels[id];
  if (b.isRevealed) return;

  b.isRevealed = true;
  b.container.eventMode = 'none';
  b.closedSprite.visible = false;

  if (b.isTrap) {
    b.trapSprite.visible = true;
    gsap.fromTo(
      b.trapSprite.scale,
      { x: 0.01, y: 0.01 },
      { x: b.closedSprite.scale.x * 1.25, y: b.closedSprite.scale.y * 1.25, duration: 0.25, ease: 'back.out(2)' }
    );

    krakenNormal.visible = false;
    krakenAngry.visible = true;
    krakenAngry.scale.set(krakenAngryScale);

    gsap.fromTo(
      krakenAngry.scale,
      { x: krakenAngryScale * 1.06, y: krakenAngryScale * 1.06 },
      { x: krakenAngryScale, y: krakenAngryScale, duration: 0.35, ease: 'back.out(2)' }
    );

    const currentRootX = rootContainer.x;
    const currentRootY = rootContainer.y;
    gsap.to(rootContainer, {
      x: '+=8',
      y: '+=6',
      duration: 0.05,
      repeat: 6,
      yoyo: true,
      onComplete: () => {
        rootContainer.position.set(currentRootX, currentRootY);
      },
    });

    endGame(true);
  } else {
    revealedCount++;
    b.goldSprite.visible = true;
    gsap.fromTo(
      b.goldSprite.scale,
      { x: 0.01, y: 0.01 },
      { x: b.closedSprite.scale.x, y: b.closedSprite.scale.y, duration: 0.35, ease: 'back.out(2)' }
    );

    spawnGoldCoins(b.container.x, b.container.y);
    gsap.to(b.tentacleSprite, { alpha: 0.15, duration: 0.4 });

    if (revealedCount === TOTAL_BARRELS - trapsCount) {
      cashOut();
      return;
    }
    updateUI();
  }
}

function endGame(isLoss: boolean) {
  isRoundActive = false;
  isGameOver = true;
  betInputElement.disabled = false;

  barrels.forEach((b) => {
    b.container.eventMode = 'none';
    b.container.cursor = 'default';

    if (b.isTrap && !b.isRevealed) {
      b.closedSprite.alpha = 0.25;
      b.trapSprite.visible = true;
      b.trapSprite.alpha = 0.55;
    }
  });

  updateUI();
}

function createSidebarUI(container: Container) {
  const panelBg = new Graphics()
    .roundRect(24, 24, 280, 712, 12)
    .fill({ color: 0x160c1d })
    .stroke({ width: 1.5, color: 0x3d1747 });
  container.addChild(panelBg);

  const fontStyle = (size: number, color = '#a682b3', bold = false) =>
    new TextStyle({ fill: color, fontSize: size, fontWeight: bold ? 'bold' : 'normal', fontFamily: 'sans-serif' });

  // 1. Баланс
  const balTitle = new Text({ text: 'Balance', style: fontStyle(13) });
  balTitle.position.set(44, 44);
  balanceValText = new Text({ text: `$${balance.toFixed(2)}`, style: fontStyle(15, '#fae8ff', true) });
  balanceValText.anchor.set(1, 0);
  balanceValText.position.set(284, 44);
  container.addChild(balTitle, balanceValText);

  // 2. Ставка
  const betTitle = new Text({ text: 'Bet Amount', style: fontStyle(13) });
  betTitle.position.set(44, 94);

  betErrorText = new Text({ text: '', style: new TextStyle({ fill: '#ff4d6d', fontSize: 11, fontWeight: 'bold', fontFamily: 'sans-serif' }) });
  betErrorText.anchor.set(1, 0);
  betErrorText.position.set(284, 95);
  container.addChild(betTitle, betErrorText);

  const betInputBg = new Graphics()
    .roundRect(44, 118, 240, 42, 6)
    .fill({ color: 0x22102b })
    .stroke({ width: 1, color: 0x481b5c });
  container.addChild(betInputBg);

  const halfBtn = createSmallBtn('½', 194, 123, () => {
    if (isRoundActive) return;
    betAmount = Math.max(1, Math.floor(betAmount / 2));
    betInputElement.value = betAmount.toString();
    betErrorText.text = '';
    updateUI();
  });
  const doubleBtn = createSmallBtn('2×', 238, 123, () => {
    if (isRoundActive) return;
    if (betAmount * 2 > balance) {
      betAmount = Math.floor(balance);
      betErrorText.text = 'Недостатньо коштів!';
      gsap.fromTo(betErrorText, { alpha: 1 }, { alpha: 0, delay: 2.5, duration: 0.5 });
    } else {
      betAmount *= 2;
      betErrorText.text = '';
    }
    betInputElement.value = betAmount.toString();
    updateUI();
  });
  container.addChild(halfBtn, doubleBtn);

  // 3. Пастки (Mines)
  const minesTitle = new Text({ text: 'Mines', style: fontStyle(13) });
  minesTitle.position.set(44, 185);
  baseMultText = new Text({ text: '', style: fontStyle(13, '#ff2a85') });
  baseMultText.anchor.set(1, 0);
  baseMultText.position.set(284, 185);
  container.addChild(minesTitle, baseMultText);

  const minesInputBg = new Graphics()
    .roundRect(44, 210, 240, 42, 6)
    .fill({ color: 0x22102b })
    .stroke({ width: 1, color: 0x481b5c });
  container.addChild(minesInputBg);

  minesValText = new Text({ text: `${trapsCount} Mines`, style: fontStyle(15, '#ffffff', true) });
  minesValText.position.set(58, 221);
  container.addChild(minesValText);

  const minusBtn = createSmallBtn('−', 194, 215, () => {
    if (isRoundActive) return;
    if (trapsCount > 1) {
      trapsCount--;
      updateUI();
    }
  });
  const plusBtn = createSmallBtn('+', 238, 215, () => {
    if (isRoundActive) return;
    if (trapsCount < TOTAL_BARRELS - 1) {
      trapsCount++;
      updateUI();
    }
  });
  container.addChild(minusBtn, plusBtn);

  // 4. Профіт
  profitValText = new Text({ text: '', style: fontStyle(14, '#a682b3') });
  profitValText.position.set(44, 275);
  container.addChild(profitValText);

  // 5. Кнопка дії
  mainActionBtn = new Container();
  mainActionBtn.position.set(44, 315);

  btnBg = new Graphics().roundRect(0, 0, 240, 50, 6).fill({ color: 0xff2a85 });
  mainActionText = new Text({ text: 'Bet', style: fontStyle(16, '#ffffff', true) });
  mainActionText.anchor.set(0.5);
  mainActionText.position.set(120, 25);

  mainActionBtn.addChild(btnBg);
  mainActionBtn.addChild(mainActionText);
  mainActionBtn.eventMode = 'static';
  mainActionBtn.cursor = 'pointer';

  mainActionBtn.on('pointertap', () => {
    if (!isRoundActive) {
      startRound();
    } else {
      cashOut();
    }
  });

  container.addChild(mainActionBtn);
}

function createSmallBtn(label: string, x: number, y: number, onClick: () => void): Container {
  const btn = new Container();
  btn.position.set(x, y);
  btn.eventMode = 'static';
  btn.cursor = 'pointer';

  const bg = new Graphics()
    .roundRect(0, 0, 36, 32, 4)
    .fill({ color: 0x33173d })
    .stroke({ width: 1, color: 0x572469 });
  const txt = new Text({
    text: label,
    style: new TextStyle({ fill: '#fae8ff', fontSize: 13, fontWeight: 'bold' }),
  });
  txt.anchor.set(0.5);
  txt.position.set(18, 16);

  btn.addChild(bg, txt);
  btn.on('pointertap', onClick);
  return btn;
}

function updateUI() {
  balanceValText.text = `$${balance.toFixed(2)}`;
  minesValText.text = `${trapsCount} Mines`;

  const baseMult = calculateMultiplier(1, trapsCount);
  baseMultText.text = `Base: ${baseMult}x`;

  if (!isRoundActive) {
    profitValText.text = '';
    btnBg.clear().roundRect(0, 0, 240, 50, 6).fill({ color: 0xff2a85 });
    mainActionText.style.fill = '#ffffff';
    mainActionText.text = isGameOver ? 'Play Again' : 'Bet';
    mainActionBtn.alpha = 1;
    mainActionBtn.eventMode = 'static';
  } else {
    if (revealedCount === 0) {
      profitValText.text = 'Pick a barrel...';
      btnBg.clear().roundRect(0, 0, 240, 50, 6).fill({ color: 0x33173d });
      mainActionText.style.fill = '#a682b3';
      mainActionText.text = 'Pick a Barrel';
      mainActionBtn.alpha = 0.6;
      mainActionBtn.eventMode = 'none';
    } else {
      const mult = calculateMultiplier(revealedCount, trapsCount);
      const totalWin = (betAmount * mult).toFixed(2);
      const profit = (betAmount * mult - betAmount).toFixed(2);

      profitValText.text = `Profit: +$${profit} (${mult}x)`;
      btnBg.clear().roundRect(0, 0, 240, 50, 6).fill({ color: 0xff2a85 });
      mainActionText.style.fill = '#ffffff';
      mainActionText.text = `Cash Out $${totalWin}`;
      mainActionBtn.alpha = 1;
      mainActionBtn.eventMode = 'static';
    }
  }
}

init();