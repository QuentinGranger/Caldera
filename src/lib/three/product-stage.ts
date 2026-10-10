import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { depthPoint } from '../motion/depth';
import { prepareProductPhoto } from './product-photo';

/** Real 3D scenery around the unchanged product photograph; no invented product sides. */
export function mountProductStage(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  photo: HTMLImageElement,
) {
  const resources: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(value: T) => {
    resources.push(value);
    return value;
  };
  let renderer: THREE.WebGLRenderer | undefined;
  let stopped = false;
  let detach = () => {};
  const dispose = () => {
    if (stopped) return;
    stopped = true;
    detach();
    delete root.dataset.productStage;
    for (const resource of resources.reverse()) resource.dispose();
    renderer?.dispose();
  };
  try {
    const photograph = prepareProductPhoto(photo);
    own({
      dispose: () => {
        photograph.width = photograph.height = 1;
      },
    });
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    renderer.setClearColor(0x071a12, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    camera.position.set(0, 0.6, 8.5);
    camera.lookAt(0, 0, 0);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      scene.environment = own(pmrem.fromScene(room, 0.04)).texture;
    } finally {
      room.dispose();
      pmrem.dispose();
    }
    scene.add(new THREE.AmbientLight(0xe8f3dc, 1));
    const key = new THREE.DirectionalLight(0xffe4a1, 4);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6edcb0, 2);
    rim.position.set(3, 2, -3);
    scene.add(rim);
    const gold = own(
      new THREE.MeshStandardMaterial({
        color: 0xe8c261,
        metalness: 0.9,
        roughness: 0.23,
      }),
    );
    const basalt = own(
      new THREE.MeshStandardMaterial({
        color: 0x17372c,
        metalness: 0.4,
        roughness: 0.48,
      }),
    );
    const plinth = new THREE.Mesh(
      own(new THREE.CylinderGeometry(1.5, 1.64, 0.23, 64)),
      basalt,
    );
    plinth.position.y = -1.52;
    scene.add(plinth);
    const ringGeometry = own(new THREE.TorusGeometry(1.51, 0.012, 6, 96));
    const edge = new THREE.Mesh(ringGeometry, gold);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = -1.39;
    scene.add(edge);
    const texture = own(new THREE.CanvasTexture(photograph));
    texture.colorSpace = THREE.SRGBColorSpace;
    const aspect = photograph.width / photograph.height;
    const productHeight = Math.min(3.5, 2.55 / aspect);
    const product = new THREE.Mesh(
      own(new THREE.PlaneGeometry(productHeight * aspect, productHeight)),
      own(
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.04,
          toneMapped: false,
        }),
      ),
    );
    // The actual opaque foot shares the plinth's top and centre in world space.
    product.position.set(0, -1.405 + productHeight / 2, 0);
    scene.add(product);
    const pointer = matchMedia('(hover: hover) and (pointer: fine)');
    let point: { x: number; y: number } | undefined;
    let active = false,
      frame = 0,
      width = 0,
      height = 0;
    const aim = { x: 0, y: 0, scroll: 0 };
    const draw = () => {
      frame = 0;
      if (stopped || !active || document.hidden) return;
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (width !== rect.width || height !== rect.height) {
        width = rect.width;
        height = rect.height;
        renderer!.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const target =
        point && pointer.matches
          ? depthPoint(point.x - rect.left, point.y - rect.top, width, height)
          : { x: 0, y: 0 };
      const scroll = depthPoint(
        0,
        innerHeight - rect.top,
        1,
        innerHeight + rect.height,
      ).y;
      aim.x += (target.x - aim.x) * 0.14;
      aim.y += (target.y - aim.y) * 0.14;
      aim.scroll += (scroll - aim.scroll) * 0.14;
      camera.position.set(
        aim.x * 0.48,
        0.65 - aim.y * 0.2 + aim.scroll * 0.25,
        8.5,
      );
      camera.lookAt(0, 0, 0);
      key.position.x = -3 + aim.x * 2;
      try {
        renderer!.render(scene, camera);
        root.dataset.productStage = 'ready';
      } catch {
        dispose();
        return;
      }
      if (
        Math.abs(aim.x - target.x) +
          Math.abs(aim.y - target.y) +
          Math.abs(aim.scroll - scroll) >
        0.002
      )
        schedule();
    };
    const schedule = () => {
      if (!stopped && active && !document.hidden && !frame)
        frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => {
      if (!pointer.matches || event.pointerType !== 'mouse') return;
      point = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const leave = () => {
      point = undefined;
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      active = Boolean(entry?.isIntersecting);
      if (!active && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      schedule();
    });
    const resize = new ResizeObserver(schedule);
    const contextLost = (event: Event) => {
      event.preventDefault();
      dispose();
    };
    observer.observe(root);
    resize.observe(root);
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', leave);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('blur', leave);
    pointer.addEventListener('change', leave);
    document.addEventListener('visibilitychange', leave);
    canvas.addEventListener('webglcontextlost', contextLost);
    detach = () => {
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('blur', leave);
      pointer.removeEventListener('change', leave);
      document.removeEventListener('visibilitychange', leave);
      canvas.removeEventListener('webglcontextlost', contextLost);
    };
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
