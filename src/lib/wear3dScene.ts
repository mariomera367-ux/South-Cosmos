import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SitioAmbiental } from './analogo';
import {
  calcularDesgasteEnDia,
  ComponentPinDiagnostic,
  HardwareSpec,
  RecubrimientoTipo,
  WearVisualMode,
  ZonaDespliegue,
} from './wearEngine';

export type CameraPresetId = 'orbital' | 'frontal' | 'lateral' | 'superior';

export interface Wear3DSceneParams {
  sitio: SitioAmbiental;
  hardware: HardwareSpec;
  recubrimiento: RecubrimientoTipo;
  zona: ZonaDespliegue;
  dias: number;
  visualMode: WearVisualMode;
  showPins: boolean;
  showDustEffect: boolean;
  selectedPinId: string | null;
  pinDiagnostics: ComponentPinDiagnostic[];
  autoRotate: boolean;
}

export class Wear3DViewportController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private rafId = 0;
  private disposed = false;

  private hardwareGroup = new THREE.Group();
  private pinsGroup = new THREE.Group();
  private floorMesh: THREE.Mesh;
  private dustPoints: THREE.Points;
  private pinMeshes = new Map<string, THREE.Mesh>();
  private primaryMat: THREE.MeshStandardMaterial;
  private accentMat: THREE.MeshStandardMaterial;

  private raycaster = new THREE.Raycaster();
  private pointerDownPos = { x: 0, y: 0 };
  private currentParams: Wear3DSceneParams;
  private onSelectPin: (pinId: string) => void;
  private onContextLostChange: (lost: boolean) => void;

  private lastHardwareSig = '';
  private cameraTargetPos: THREE.Vector3 | null = null;
  private controlsTargetGoal: THREE.Vector3 | null = null;

  constructor(
    container: HTMLElement,
    initialParams: Wear3DSceneParams,
    onSelectPin: (pinId: string) => void,
    onContextLostChange: (lost: boolean) => void
  ) {
    this.container = container;
    this.currentParams = initialParams;
    this.onSelectPin = onSelectPin;
    this.onContextLostChange = onContextLostChange;

    const w = Math.max(300, container.clientWidth);
    const h = Math.max(260, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x07090e, 1);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x07090e, 0.045);

    this.camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 80);
    this.camera.position.set(3.4, 2.3, 3.8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.set(0, 0.75, 0);
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 12;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    // Iluminación
    const hemi = new THREE.HemisphereLight(0xcbe8ff, 0x261d18, 0.9);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff4e0, 1.5);
    dir.position.set(5, 8, 4);
    this.scene.add(dir);
    const rim = new THREE.DirectionalLight(0x22d3ee, 0.55);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);

    // Suelo de regolito con cuadrícula técnica
    const floorGeo = new THREE.CircleGeometry(7.5, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1c1715,
      roughness: 0.92,
      metalness: 0.06,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.floorMesh);

    const grid = new THREE.GridHelper(12, 24, 0x1e293b, 0x0f172a);
    grid.position.y = 0.004;
    this.scene.add(grid);

    this.primaryMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.55,
      roughness: 0.35,
    });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.35,
      roughness: 0.4,
    });

    this.scene.add(this.hardwareGroup);
    this.scene.add(this.pinsGroup);

    // Partículas de polvo en suspensión
    const count = 240;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 1] = Math.random() * 2.8 + 0.05;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 9;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xd97706,
      size: 0.04,
      transparent: true,
      opacity: 0.55,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.handleContextLost
    );
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.handleContextRestored
    );

    this.syncParams(initialParams);
    this.animate();
  }

  private handleContextLost = (ev: Event) => {
    ev.preventDefault();
    this.onContextLostChange(true);
  };

  private handleContextRestored = () => {
    this.onContextLostChange(false);
  };

  private handlePointerDown = (ev: PointerEvent) => {
    this.pointerDownPos = { x: ev.clientX, y: ev.clientY };
    this.cameraTargetPos = null;
    this.controlsTargetGoal = null;
  };

  private handlePointerUp = (ev: PointerEvent) => {
    const dist = Math.hypot(
      ev.clientX - this.pointerDownPos.x,
      ev.clientY - this.pointerDownPos.y
    );
    if (dist > 6 || !this.currentParams.showPins) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = Array.from(this.pinMeshes.values());
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const pinId = hits[0].object.userData.pinId as string | undefined;
      if (pinId) this.onSelectPin(pinId);
    }
  };

  private clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material !== this.primaryMat && child.material !== this.accentMat) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      }
    }
  }

  private rebuildHardware(hw: HardwareSpec) {
    this.clearGroup(this.hardwareGroup);

    if (hw.customModel?.format === 'obj' && hw.customModel.vertices) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(hw.customModel.vertices, 3)
      );
      if (hw.customModel.normals) {
        geo.setAttribute(
          'normal',
          new THREE.BufferAttribute(hw.customModel.normals, 3)
        );
      } else {
        geo.computeVertexNormals();
      }
      const mesh = new THREE.Mesh(geo, this.primaryMat);
      this.hardwareGroup.add(mesh);
      return;
    }

    if (hw.customModel?.format === 'json' && hw.customModel.boxes?.length) {
      for (const b of hw.customModel.boxes) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]),
          this.primaryMat
        );
        box.position.set(b.pos[0], b.pos[1], b.pos[2]);
        this.hardwareGroup.add(box);
      }
      return;
    }

    if (hw.tipo === 'traje') {
      const legs = [
        [-0.18, 0.35, 0],
        [0.18, 0.35, 0],
      ];
      for (const [lx, ly, lz] of legs) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.13, 0.7, 16),
          this.primaryMat
        );
        leg.position.set(lx, ly, lz);
        this.hardwareGroup.add(leg);
      }
      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.25, 0.68, 20),
        this.primaryMat
      );
      torso.position.set(0, 1.05, 0);
      this.hardwareGroup.add(torso);

      const plss = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.56, 0.26),
        this.accentMat
      );
      plss.position.set(0, 1.12, -0.28);
      this.hardwareGroup.add(plss);

      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 24, 24),
        this.primaryMat
      );
      helmet.position.set(0, 1.56, 0.02);
      this.hardwareGroup.add(helmet);

      const visor = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 20, 16, 0, Math.PI, 0, Math.PI),
        this.accentMat
      );
      visor.position.set(0, 1.56, 0.1);
      this.hardwareGroup.add(visor);

      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.075, 0.55, 14),
          this.primaryMat
        );
        arm.rotation.z = side * 0.38;
        arm.position.set(side * 0.38, 1.06, 0.04);
        this.hardwareGroup.add(arm);
      }
      return;
    }

    if (hw.tipo === 'base') {
      const baseRing = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.45, 0.24, 32),
        this.primaryMat
      );
      baseRing.position.set(0, 0.12, 0);
      this.hardwareGroup.add(baseRing);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.22, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.52),
        this.primaryMat
      );
      dome.position.set(0, 0.22, 0);
      this.hardwareGroup.add(dome);

      const airlock = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.72, 0.75),
        this.accentMat
      );
      airlock.position.set(1.25, 0.38, 0);
      this.hardwareGroup.add(airlock);

      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.06, 0.7),
        this.accentMat
      );
      panel.rotation.x = 0.32;
      panel.position.set(-1.45, 0.45, 0.55);
      this.hardwareGroup.add(panel);
      return;
    }

    // Rover 6x6 por defecto
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.44, 1.05),
      this.primaryMat
    );
    body.position.set(0, 0.62, 0);
    this.hardwareGroup.add(body);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.08, 0.92),
      this.accentMat
    );
    deck.position.set(-0.08, 0.88, 0);
    this.hardwareGroup.add(deck);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.72, 12),
      this.primaryMat
    );
    mast.position.set(0.52, 1.18, 0.2);
    this.hardwareGroup.add(mast);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.18, 0.36),
      this.accentMat
    );
    head.position.set(0.55, 1.56, 0.2);
    this.hardwareGroup.add(head);

    const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 18);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelXs = [-0.72, 0, 0.72];
    const wheelZs = [-0.68, 0.68];
    for (const wx of wheelXs) {
      for (const wz of wheelZs) {
        const wMesh = new THREE.Mesh(wheelGeo.clone(), this.accentMat);
        wMesh.position.set(wx, 0.24, wz);
        this.hardwareGroup.add(wMesh);

        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.44, 8),
          this.primaryMat
        );
        strut.position.set(wx * 0.88, 0.42, wz * 0.86);
        this.hardwareGroup.add(strut);
      }
    }
    wheelGeo.dispose();
  }

  private rebuildPins(
    diagnostics: ComponentPinDiagnostic[],
    selectedPinId: string | null,
    visible: boolean
  ) {
    this.clearGroup(this.pinsGroup);
    this.pinMeshes.clear();
    this.pinsGroup.visible = visible;
    if (!visible) return;

    for (const pin of diagnostics) {
      const isSelected = pin.id === selectedPinId;
      const color =
        pin.estado === 'Crítico'
          ? 0xf43f5e
          : pin.estado === 'Vigilancia'
            ? 0xf59e0b
            : 0x22d3ee;

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? 0.095 : 0.068, 16, 16),
        new THREE.MeshBasicMaterial({ color })
      );
      sphere.position.set(pin.pos3d[0], pin.pos3d[1], pin.pos3d[2]);
      sphere.userData.pinId = pin.id;
      this.pinsGroup.add(sphere);
      this.pinMeshes.set(pin.id, sphere);
    }
  }

  syncParams(params: Wear3DSceneParams) {
    this.currentParams = params;
    this.controls.autoRotate = params.autoRotate;
    this.controls.autoRotateSpeed = 1.15;

    const hwSig = `${params.hardware.id}:${params.hardware.tipo}:${params.hardware.customModel?.fileName ?? ''}`;
    if (hwSig !== this.lastHardwareSig) {
      this.lastHardwareSig = hwSig;
      this.rebuildHardware(params.hardware);
    }

    const metrics = calcularDesgasteEnDia(
      params.sitio,
      params.hardware,
      params.zona,
      params.dias,
      params.recubrimiento
    );

    // Modulación visual de materiales según modo
    const wearRatio = Math.max(0, Math.min(1, (100 - metrics.integridadGlobal) / 100));
    if (params.visualMode === 'termico') {
      const heat = Math.min(1, (metrics.tMaxLocalK - 220) / 180);
      this.primaryMat.color.setHSL(0.08 - heat * 0.07, 0.78, 0.48);
      this.accentMat.color.setHSL(0.03, 0.9, 0.55);
      this.primaryMat.roughness = 0.5;
    } else if (params.visualMode === 'mecanico') {
      const abr = Math.min(1, metrics.abrasionMecanica / 65);
      this.primaryMat.color.setHSL(0.1 + (1 - abr) * 0.4, 0.65, 0.46);
      this.accentMat.color.setHex(0xf59e0b);
      this.primaryMat.roughness = 0.45 + abr * 0.45;
    } else if (params.visualMode === 'radiacion') {
      const rad = Math.min(1, metrics.degradacionRadiacion / 45);
      this.primaryMat.color.setHSL(0.75 - rad * 0.1, 0.72, 0.48);
      this.accentMat.color.setHex(0xa855f7);
      this.primaryMat.roughness = 0.35;
    } else {
      this.primaryMat.color.setHex(params.hardware.tipo === 'traje' ? 0xe2e8f0 : 0x94a3b8);
      this.accentMat.color.setHex(0xd97706);
      this.primaryMat.roughness = Math.min(0.95, 0.28 + wearRatio * 0.6);
    }

    // Color del suelo según sitio (Tierra, Marte o Luna)
    const floorMat = this.floorMesh.material as THREE.MeshStandardMaterial;
    if (params.sitio.id.includes('luna') || params.sitio.P[0] < 1) {
      floorMat.color.setHex(0x272a30);
    } else if (params.sitio.id.includes('marte') || (params.sitio.suelo.Fe2O3 ?? 0) > 0.13) {
      floorMat.color.setHex(0x4a2518);
    } else {
      floorMat.color.setHex(0x3a2e22);
    }

    this.dustPoints.visible = params.showDustEffect;
    this.rebuildPins(
      params.pinDiagnostics,
      params.selectedPinId,
      params.showPins
    );
  }

  focusOnComponent(pinId: string) {
    const pin = this.currentParams.pinDiagnostics.find((p) => p.id === pinId);
    if (!pin) return;
    const goal = new THREE.Vector3(pin.pos3d[0], pin.pos3d[1], pin.pos3d[2]);
    this.controlsTargetGoal = goal;
    this.cameraTargetPos = goal.clone().add(new THREE.Vector3(1.55, 0.9, 1.75));
  }

  setCameraPreset(preset: CameraPresetId) {
    this.controlsTargetGoal = new THREE.Vector3(0, 0.75, 0);
    if (preset === 'frontal') {
      this.cameraTargetPos = new THREE.Vector3(0, 1.15, 4.2);
    } else if (preset === 'lateral') {
      this.cameraTargetPos = new THREE.Vector3(4.3, 1.15, 0);
    } else if (preset === 'superior') {
      this.cameraTargetPos = new THREE.Vector3(0.01, 5.2, 0.4);
    } else {
      this.cameraTargetPos = new THREE.Vector3(3.4, 2.3, 3.8);
    }
  }

  captureDataUrl(): string | null {
    try {
      this.renderer.render(this.scene, this.camera);
      return this.renderer.domElement.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  resize() {
    if (this.disposed) return;
    const w = Math.max(300, this.container.clientWidth);
    const h = Math.max(260, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);

    if (this.cameraTargetPos && this.controlsTargetGoal) {
      this.camera.position.lerp(this.cameraTargetPos, 0.1);
      this.controls.target.lerp(this.controlsTargetGoal, 0.1);
      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.04) {
        this.cameraTargetPos = null;
        this.controlsTargetGoal = null;
      }
    }

    if (this.dustPoints.visible) {
      const windSpeed = Math.max(0.2, this.currentParams.sitio.viento[0]);
      this.dustPoints.rotation.y += 0.0007 * windSpeed;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored
    );
    this.controls.dispose();
    this.clearGroup(this.hardwareGroup);
    this.clearGroup(this.pinsGroup);
    this.floorMesh.geometry.dispose();
    (this.floorMesh.material as THREE.Material).dispose();
    this.dustPoints.geometry.dispose();
    (this.dustPoints.material as THREE.Material).dispose();
    this.primaryMat.dispose();
    this.accentMat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
