import { chromium } from 'playwright';
import path from 'path';

async function run() {
  console.log('Launching headless Chrome...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 }
  });

  page.on('console', msg => {
    console.log(`[PAGE ${msg.type().toUpperCase()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.error('[PAGE ERROR]:', err);
  });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // Wait 1 second for Three.js and Rapier to initialize
  await page.waitForTimeout(1000);

  // Click canvas or overlay to start game
  const overlay = page.locator('#click-to-play-overlay');
  if (await overlay.isVisible()) {
    console.log('Clicking start overlay...');
    await overlay.click();
  } else {
    await page.mouse.click(640, 360);
  }

  await page.waitForTimeout(500);

  // Check animation and player state
  const diagnostics = await page.evaluate(() => {
    const d = window.__DEBUG__;
    if (!d) return { error: '__DEBUG__ not found' };
    const p = d.playerController;
    const c = d.camera;
    const l = d.lighting;
    const h = d.heightFunction;
    return {
      playerPos: p?.currentPos,
      isGrounded: p?.isGrounded,
      currentSpeed: p?.currentSpeed,
      stateId: p?.stateMachine?.getCurrentStateId(),
      cameraPos: c?.camera?.position,
      cameraTarget: c?.target,
      lightingPreset: l?.activePreset,
      playerLightPos: l?.playerLight?.position,
      playerLightVisible: l?.playerLight?.visible,
      playerLightIntensity: l?.playerLight?.intensity,
      hemiIntensity: l?.hemiLight?.intensity,
      dirLightVisible: l?.dirLight?.visible,
      terrainHeightAtPlayer: h?.getHeight(p?.currentPos?.x || 0, p?.currentPos?.z || 0),
      hasPostPipeline: !!d.postPipeline,
      animLogical: p?.anim?.currentLogicalAnim,
      fallbackActive: p?.anim?.fallbackActive,
      fallbackReason: p?.anim?.fallbackReason
    };
  });
  console.log('Diagnostics 1:', JSON.stringify(diagnostics, null, 2));

  // Take initial idle screenshot
  await page.screenshot({ path: 'scripts/screenshot_initial.png' });
  console.log('Saved screenshot_initial.png');

  // Check post-processing screenshot
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scripts/screenshot_with_post.png' });
  console.log('Saved screenshot_with_post.png');

  // Press W to move forward
  console.log('Pressing KeyW to move forward...');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);

  const movingDiag = await page.evaluate(() => {
    const d = window.__DEBUG__;
    const p = d?.playerController;
    const anim = p?.anim;
    const skeleton = anim?.skeleton;
    const leftLeg = skeleton?.bones?.find(b => b.name === 'mixamorig_LeftUpLeg');
    const rightLeg = skeleton?.bones?.find(b => b.name === 'mixamorig_RightUpLeg');
    const leftArm = skeleton?.bones?.find(b => b.name === 'mixamorig_LeftArm');
    return {
      currentSpeed: p?.currentSpeed,
      stateId: p?.stateMachine?.getCurrentStateId(),
      animLogical: anim?.currentLogicalAnim,
      leftLegRotX: leftLeg?.rotation?.x,
      rightLegRotX: rightLeg?.rotation?.x,
      leftArmRotX: leftArm?.rotation?.x,
      leftLegQuat: leftLeg ? { x: leftLeg.quaternion.x, y: leftLeg.quaternion.y, z: leftLeg.quaternion.z, w: leftLeg.quaternion.w } : null
    };
  });
  console.log('Moving Diagnostics at t=350ms:', JSON.stringify(movingDiag, null, 2));

  await page.screenshot({ path: 'scripts/screenshot_moving.png' });
  console.log('Saved screenshot_moving.png');

  await page.waitForTimeout(350);
  const movingDiag2 = await page.evaluate(() => {
    const d = window.__DEBUG__;
    const p = d?.playerController;
    const anim = p?.anim;
    const skeleton = anim?.skeleton;
    const leftLeg = skeleton?.bones?.find(b => b.name === 'mixamorig_LeftUpLeg');
    const rightLeg = skeleton?.bones?.find(b => b.name === 'mixamorig_RightUpLeg');
    return {
      animLogical: anim?.currentLogicalAnim,
      leftLegRotX: leftLeg?.rotation?.x,
      rightLegRotX: rightLeg?.rotation?.x,
      leftLegQuat: leftLeg ? { x: leftLeg.quaternion.x, y: leftLeg.quaternion.y, z: leftLeg.quaternion.z, w: leftLeg.quaternion.w } : null
    };
  });
  console.log('Moving Diagnostics at t=700ms:', JSON.stringify(movingDiag2, null, 2));

  await page.keyboard.up('KeyW');

  // Perform light attack (Left click)
  console.log('Clicking to attack...');
  await page.mouse.click(640, 360);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'scripts/screenshot_attacking.png' });
  console.log('Saved screenshot_attacking.png');

  await browser.close();
  console.log('Done!');
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
