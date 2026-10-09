import * as THREE from 'three';
import { chapterFlow } from '../motion/journey';
import { depthPoint } from '../motion/depth';
import { cardSheen } from './card-sheen';
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
/** Lazy, demand-rendered WebGL enhancement. Static HTML is the failure mode. */
export async function mountCardStory(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  signal?: AbortSignal,
) {
  const [noctali, giratina, rayquaza, backArt] = await Promise.all([
    image('/assets/images/experience/noctali-vmax-215-203.webp'),
    image('/assets/images/experience/giratina-v-186-196.webp'),
    image('/assets/images/experience/rayquaza-gold-star-107-107.webp'),
    image('/assets/images/experience/pokemon-card-back.webp'),
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
    const texture = (art: HTMLImageElement) => {
      const map = own(new THREE.Texture(art));
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      map.anisotropy = Math.min(4, renderer!.capabilities.getMaxAnisotropy());
      return map;
    };
    const back = texture(backArt);
    const edge = own(
      new THREE.MeshStandardMaterial({
        color: 0xe8c261,
        metalness: 0.85,
        roughness: 0.25,
      }),
    );
    const face = (art: HTMLImageElement) =>
      own(
        // Keep the original printed colours; the scene lights act on the bevel.
        new THREE.MeshBasicMaterial({
          map: texture(art),
          toneMapped: false,
        }),
      );
    const reverse = own(
      new THREE.MeshBasicMaterial({
        map: back,
        toneMapped: false,
      }),
    );
    const bodyGeometry = own(
      new THREE.ExtrudeGeometry(rounded(2.4, 3.3, 0.14), {
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
      new THREE.ShapeGeometry(rounded(2.4, 3.3, 0.14), 8),
    );
    const uv = faceGeometry.getAttribute('uv');
    const positions = faceGeometry.getAttribute('position');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, positions.getX(i) / 2.4 + 0.5, positions.getY(i) / 3.3 + 0.5);
    const sheen = own(cardSheen());
    const card = (art: HTMLImageElement) => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(bodyGeometry, edge));
      const a = new THREE.Mesh(faceGeometry, face(art));
      a.position.z = 0.043;
      const b = new THREE.Mesh(faceGeometry, reverse);
      b.position.z = -0.043;
      b.rotation.y = Math.PI;
      const reflection = new THREE.Mesh(faceGeometry, sheen);
      reflection.position.z = 0.045;
      group.add(a, b, reflection);
      return group;
    };
    const assembly = new THREE.Group();
    const main = card(noctali),
      left = card(giratina),
      right = card(rayquaza);
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
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let point: { x: number; y: number } | undefined;
    const aim = new THREE.Vector2();
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
      const handoff = chapterFlow(rect.top, rect.height, height);
      const compact = width < 1024;
      const target =
        point && pointer.matches && !compact
          ? depthPoint(point.x - stage.left, point.y - stage.top, width, height)
          : { x: 0, y: 0 };
      aim.x += (target.x - aim.x) * 0.16;
      aim.y += (target.y - aim.y) * 0.16;
      sheen.uniforms.uTravel!.value = progress;
      sheen.uniforms.uAim!.value.copy(aim);
      const scale =
        pose.scale * (compact ? Math.min(0.55, (width / height) * 0.84) : 1);
      assembly.scale.setScalar(
        scale *
          (0.65 + handoff.arrival * 0.35) *
          (1 - handoff.departure * 0.28),
      );
      assembly.position.set(
        (compact ? 0 : camera.aspect * 1.3) + pose.x,
        (compact ? 1.15 : 0) +
          pose.y -
          (1 - handoff.arrival) -
          handoff.departure * 0.7,
        pose.z,
      );
      assembly.rotation.set(
        pose.rx - aim.y * 0.08,
        pose.ry - (1 - handoff.arrival) * 0.55 + aim.x * 0.15,
        pose.rz,
      );
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
      if (Math.abs(aim.x - target.x) + Math.abs(aim.y - target.y) > 0.001)
        schedule();
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
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !pointer.matches) return;
      point = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const leave = () => {
      point = undefined;
      schedule();
    };
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    pointer.addEventListener('change', leave);
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
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
      pointer.removeEventListener('change', leave);
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
