import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  cardStoryPose,
  cardStoryProgress,
  cardFanPose,
} from './card-story-motion';

function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const asset = new Image();
    asset.onload = () => resolve(asset);
    asset.onerror = () => reject(new Error('Card illustration unavailable'));
    asset.src = url;
  });
}
function rounded(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2,
    y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}
function backArtwork(logo: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1152;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#06281e';
  ctx.fillRect(0, 0, 768, 1152);
  ctx.strokeStyle = '#e8c261';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, 712, 1096);
  ctx.strokeRect(40, 40, 688, 1072);
  ctx.save();
  ctx.translate(384, 530);
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8);
    ctx.beginPath();
    ctx.moveTo(0, -330);
    ctx.lineTo(110, 0);
    ctx.lineTo(0, 330);
    ctx.globalAlpha = 0.11;
    ctx.stroke();
  }
  ctx.restore();
  const w = 600,
    h = (w * logo.height) / logo.width;
  ctx.drawImage(logo, (768 - w) / 2, 530 - h / 2, w, h);
  ctx.fillStyle = '#e8c261';
  ctx.font = '20px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('CARTES · COLLECTION · AVENTURE', 384, 940);
  return canvas;
}

/** Lazy, demand-rendered WebGL enhancement. Static HTML is the failure mode. */
export async function mountCardStory(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  signal?: AbortSignal,
) {
  const [art, logo] = await Promise.all([
    image('/assets/images/experience/caldera-card-front.webp'),
    image('/assets/brand/logo-header-no-bg.png'),
  ]);
  if (signal?.aborted) return () => {};
  const resources: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(resource: T) => {
    resources.push(resource);
    return resource;
  };
  let renderer: THREE.WebGLRenderer | undefined;
  let disposeListeners = () => {};
  let disposed = false;
  const chapters = Array.from(
    root.querySelectorAll<HTMLElement>('[data-card-chapter]'),
  );
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeListeners();
    delete root.dataset.cardState;
    delete root.dataset.cardLayout;
    delete root.dataset.cardChapter;
    root.style.removeProperty('--card-progress');
    for (const chapter of chapters) {
      delete chapter.dataset.active;
      chapter.removeAttribute('aria-hidden');
    }
    for (const resource of resources.reverse()) resource.dispose();
    renderer?.dispose();
  };
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    renderer.setClearColor(0x03140e, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.z = 9;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = own(pmrem.fromScene(room, 0.04));
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.AmbientLight(0xffedc9, 0.8));
    const key = new THREE.DirectionalLight(0xffedc9, 2.5);
    key.position.set(-3, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x86ffd0, 3);
    rim.position.set(5, -2, -3);
    scene.add(rim);
    const front = own(new THREE.Texture(art));
    front.colorSpace = THREE.SRGBColorSpace;
    front.needsUpdate = true;
    const back = own(new THREE.CanvasTexture(backArtwork(logo)));
    back.colorSpace = THREE.SRGBColorSpace;
    front.anisotropy = back.anisotropy = Math.min(
      4,
      renderer.capabilities.getMaxAnisotropy(),
    );
    const edge = own(
      new THREE.MeshStandardMaterial({
        color: 0xe8c261,
        metalness: 0.85,
        roughness: 0.25,
      }),
    );
    const face = own(
      new THREE.MeshPhysicalMaterial({
        map: front,
        metalness: 0.02,
        roughness: 0.6,
        envMapIntensity: 0.4,
        clearcoat: 0.12,
        clearcoatRoughness: 0.4,
      }),
    );
    const reverse = own(
      new THREE.MeshPhysicalMaterial({
        map: back,
        metalness: 0.25,
        roughness: 0.4,
        clearcoat: 0.7,
      }),
    );
    const bodyGeometry = own(
      new THREE.ExtrudeGeometry(rounded(2.4, 3.6, 0.14), {
        depth: 0.045,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.018,
        bevelSegments: 2,
        steps: 1,
        curveSegments: 8,
      }),
    );
    bodyGeometry.translate(0, 0, -0.0225);
    const faceGeometry = own(
      new THREE.ShapeGeometry(rounded(2.29, 3.49, 0.11), 8),
    );
    const uv = faceGeometry.getAttribute('uv');
    const positions = faceGeometry.getAttribute('position');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        positions.getX(i) / 2.29 + 0.5,
        positions.getY(i) / 3.49 + 0.5,
      );
    const card = () => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(bodyGeometry, edge));
      const a = new THREE.Mesh(faceGeometry, face);
      a.position.z = 0.043;
      const b = new THREE.Mesh(faceGeometry, reverse);
      b.position.z = -0.043;
      b.rotation.y = Math.PI;
      group.add(a, b);
      return group;
    };
    const assembly = new THREE.Group();
    const main = card(),
      left = card(),
      right = card();
    assembly.add(left, right, main);
    scene.add(assembly);
    const haloGeometry = own(new THREE.TorusGeometry(2.55, 0.009, 6, 100));
    const haloMaterial = own(
      new THREE.MeshBasicMaterial({
        color: 0xe8c261,
        transparent: true,
        opacity: 0.23,
      }),
    );
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.z = -1;
    scene.add(halo);
    let frame = 0,
      active = false,
      width = 0,
      height = 0;
    let chapterIndex = -1;
    const draw = () => {
      frame = 0;
      if (disposed || !active || document.hidden) return;
      const stage = canvas.getBoundingClientRect();
      if (!stage.width || !stage.height) return;
      if (stage.width !== width || stage.height !== height) {
        width = stage.width;
        height = stage.height;
        renderer!.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const rect = root.getBoundingClientRect();
      const progress = cardStoryProgress(rect.top, rect.height, height);
      const pose = cardStoryPose(progress);
      const compact = width < 1024;
      const scale =
        pose.scale * (compact ? Math.min(0.55, (width / height) * 0.84) : 1);
      assembly.scale.setScalar(scale);
      assembly.position.set(
        (compact ? 0 : camera.aspect * 1.3) + pose.x,
        (compact ? 1.15 : 0) + pose.y,
        pose.z,
      );
      assembly.rotation.set(pose.rx, pose.ry, pose.rz);
      for (const [mesh, direction] of [
        [left, -1],
        [right, 1],
      ] as const) {
        mesh.visible = pose.fan > 0.001;
        const offset = cardFanPose(pose.fan, direction);
        mesh.position.set(offset.x, offset.y, offset.z);
        mesh.rotation.set(0, offset.ry, offset.rz);
      }
      halo.position.x = assembly.position.x;
      halo.position.y = compact ? 1.15 : 0;
      halo.scale.setScalar(compact ? 0.6 : 1);
      halo.rotation.set(0.3 + progress * 0.6, progress * 0.8, progress * 0.5);
      key.position.x = -3 + progress * 7;
      try {
        renderer!.render(scene, camera);
      } catch {
        dispose();
        root.dataset.cardState = 'fallback';
        return;
      }
      root.style.setProperty('--card-progress', progress.toFixed(4));
      if (chapterIndex !== pose.chapter) {
        chapterIndex = pose.chapter;
        root.dataset.cardChapter = String(chapterIndex);
        chapters.forEach((chapter, index) => {
          chapter.toggleAttribute('data-active', index === chapterIndex);
          chapter.setAttribute('aria-hidden', String(index !== chapterIndex));
        });
      }
    };
    const schedule = () => {
      if (!disposed && active && !document.hidden && !frame)
        frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      active = Boolean(entry?.isIntersecting);
      if (!active && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      schedule();
    });
    observer.observe(root);
    const resize = new ResizeObserver(schedule);
    resize.observe(canvas);
    const contextLost = (event: Event) => {
      event.preventDefault();
      dispose();
      root.dataset.cardState = 'fallback';
    };
    canvas.addEventListener('webglcontextlost', contextLost);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    disposeListeners = () => {
      observer.disconnect();
      resize.disconnect();
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener('webglcontextlost', contextLost);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
    root.dataset.cardState = 'ready';
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
