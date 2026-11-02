// Entry point: bootstrap the Babylon scene, wire all features to the sidebar,
// expose drag-drop loading. The dev-only Babylon Inspector loads on demand
// behind ?inspector=1.

import './ui/style.css';

import { createScene } from './scene';
import {
    loadCadFile,
    FileTooLargeError,
    UnsupportedFormatError,
    OcctReadError,
    WorkerFailedError,
    EmptyGeometryError,
    MAX_FILE_BYTES,
} from './loader';
import { buildModel, type BuiltModel, type FaceRef } from './builder';
import { frameCamera } from './camera-frame';
import { attachPicking } from './features/picking';
import { renderTree } from './features/tree';
import { ExplodeController } from './features/explode';
import { StageController } from './features/stage-controller';
import { MeasureController } from './features/measure';
import { downloadScreenshot } from './features/screenshot';
import { initCadBridge, getAssemblyPath, type CadViewerBridge, type SelectedPartData } from './bridge';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import {
    getRefs,
    wireDropZone,
    renderSampleList,
    showProgress,
    hideProgress,
    toast,
    renderSelectionInfo,
    renderStepInfo,
    type SampleEntry,
} from './ui/sidebar';

const base = import.meta.env.BASE_URL;

const SAMPLES: SampleEntry[] = [
    {
        label: 'Cube with hole (9 KB)',
        url: `${base}samples/cube-hole.step`,
        note: 'Formlabs/foxtrot, Apache-2.0',
    },
    {
        label: 'Motor holder (234 KB)',
        url: `${base}samples/motor-holder.step`,
        note: 'TheRobotStudio/SO-ARM100, Apache-2.0',
    },
    {
        label: 'Servo body (241 KB)',
        url: `${base}samples/servo-body.step`,
        note: 'TheRobotStudio/SO-ARM100, Apache-2.0',
    },
];

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const refs = getRefs();
const { engine, scene, camera } = createScene(canvas);
const measure = new MeasureController(scene, 'mm');

let currentModel: BuiltModel | null = null;
let currentName = 'model';
let explode: ExplodeController | null = null;
let stageController: StageController | null = null;
let currentFace: FaceRef | null = null;
let isLoading = false;
let bridge: CadViewerBridge | null = null;

const picking = attachPicking(
    scene,
    () => currentModel,
    {
        onSelect: (face) => {
            currentFace = face;
            const currentStep = stageController?.getCurrentStep();
            renderSelectionInfo(refs, face, currentStep);
            if (face) {
                const node = face.mesh.parent instanceof TransformNode ? face.mesh.parent : null;
                const parentNode = node?.parent instanceof TransformNode ? node.parent : null;
                const assemblyPath = getAssemblyPath(node || (face.mesh as any));
                const selectedData: SelectedPartData = {
                    nodeName: face.nodeName,
                    id: face.nodeName || String(face.mesh.uniqueId),
                    faceIndex: face.faceIndex,
                    meshName: face.mesh.name,
                    parentId: parentNode?.name || '',
                    assemblyPath,
                    metadata: {
                        uniqueId: face.mesh.uniqueId,
                        faceIndex: face.faceIndex,
                        meshName: face.mesh.name,
                    },
                };
                stageController?.setSelectedComponent(selectedData);
                bridge?.notifyPartSelected(selectedData);
            } else {
                stageController?.setSelectedComponent(null);
                bridge?.notifyPartSelected(null);
            }
        },
    },
    () => measure.isEnabled(),
);

function clearScene(): void {
    // Drop hover/select first — they hold FaceRefs into meshes we are about to
    // dispose, and keeping them would pin the old geometry for the session.
    picking.reset();
    currentFace = null;
    if (stageController) {
        stageController.dispose();
        stageController = null;
    }
    if (currentModel) {
        for (const m of currentModel.meshes) m.dispose(false, true);
        currentModel.root.dispose();
        currentModel = null;
    }
    measure.clear();
    explode = null;
    refs.explodeSlider.value = '0';
    refs.explodeSlider.disabled = true;
    renderSelectionInfo(refs, null);
    renderStepInfo(refs, null, 0, 1, []);
    refs.treeRoot.replaceChildren();
}

/** Build the scene from an already-fetched blob. Callers own isLoading. */
async function applyLoad(file: File | Blob, name: string): Promise<void> {
    const result = await loadCadFile(file, name);
    clearScene();
    const model = buildModel(scene, result);
    currentModel = model;
    currentName = name.replace(/\.[^.]+$/, '');
    renderTree(model.root, refs.treeRoot, camera);
    frameCamera(camera, model.meshes);

    // Initialize Explode Controller (continuous)
    explode = new ExplodeController(model);

    // Initialize Sequential Stage Controller (Task 2)
    stageController = new StageController(scene, model);
    stageController.onStepChanged((step, index, total) => {
        renderStepInfo(refs, step, index, total, stageController?.getConfig().explosionSteps || []);
        refs.explodeSlider.value = String(Math.round(step.explodeFactor * 100));
        bridge?.notifyStepChanged(step, index, total);
        if (currentFace) {
            renderSelectionInfo(refs, currentFace, step);
        }
    });

    const initialStep = stageController.getCurrentStep();
    const totalSteps = stageController.getTotalSteps();
    renderStepInfo(refs, initialStep, 0, totalSteps, stageController.getConfig().explosionSteps);

    refs.explodeSlider.disabled = explode.partCount < 2;
    refs.explodeSlider.value = String(Math.round(initialStep.explodeFactor * 100));

    if (model.meshes.length === 0) {
        toast(refs, 'File loaded but no geometry was returned.', 'warn');
    } else if (explode.partCount < 2) {
        toast(refs, `Loaded ${model.meshes.length} mesh(es), ${model.faces.size} face(s). Single part, so Explode is off.`);
    } else {
        toast(refs, `Loaded ${model.meshes.length} mesh(es), ${model.faces.size} face(s).`);
    }

    if (bridge) {
        const metadata = {
            name: currentName,
            meshCount: model.meshes.length,
            faceCount: model.faces.size,
            partCount: explode.partCount,
            parts: model.topLevel.map((m) => m.name).filter(Boolean),
            currentStep: 1,
            totalSteps,
            isAutoInferred: stageController.getConfig().isAutoInferred,
            steps: stageController.getConfig().explosionSteps,
        };
        bridge.notifyModelLoaded(metadata);
        bridge.notifyAssemblyLoaded(metadata);
    }
}

function reportLoadError(err: unknown): void {
    const errorMsg = (err as Error)?.message ?? String(err);
    bridge?.notifyError(errorMsg);
    if (
        err instanceof FileTooLargeError ||
        err instanceof UnsupportedFormatError ||
        err instanceof OcctReadError ||
        err instanceof WorkerFailedError ||
        err instanceof EmptyGeometryError
    ) {
        toast(refs, err.message, 'error');
        return;
    }
    console.error(err);
    toast(refs, `Loading failed: ${(err as Error).message}`, 'error');
}

async function loadFromFile(file: File | Blob, name: string): Promise<void> {
    if (isLoading) {
        toast(refs, 'Still loading, please wait.', 'warn');
        return;
    }
    isLoading = true;
    showProgress(refs, `Loading ${name}\u2026`);
    try {
        await applyLoad(file, name);
    } catch (err) {
        reportLoadError(err);
    } finally {
        isLoading = false;
        hideProgress(refs);
    }
}

async function loadFromUrl(sample: SampleEntry): Promise<void> {
    // The guard has to live here too, not only in loadFromFile: without it a
    // second sample click during a fetch fell through, and whichever request
    // finished last won — the label said B while the viewport showed A.
    if (isLoading) {
        toast(refs, 'Still loading, please wait.', 'warn');
        return;
    }
    isLoading = true;
    showProgress(refs, `Fetching ${sample.label}\u2026`);
    try {
        const response = await fetch(sample.url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${sample.url}`);
        }
        const blob = await response.blob();
        const name = sample.url.split('/').pop() ?? 'sample.step';
        showProgress(refs, `Loading ${name}\u2026`);
        await applyLoad(blob, name);
    } catch (err) {
        reportLoadError(err);
    } finally {
        isLoading = false;
        hideProgress(refs);
    }
}

wireDropZone(refs, (file, name) => {
    // Checked here as well as inside loadCadFile so an oversized file is
    // rejected instantly, before the multi-MB arrayBuffer() read.
    if (file.size > MAX_FILE_BYTES) {
        toast(refs, new FileTooLargeError(file.size).message, 'error');
        return;
    }
    loadFromFile(file, name);
}, (message) => toast(refs, message, 'warn'));
renderSampleList(refs, SAMPLES, (sample) => loadFromUrl(sample));

bridge = initCadBridge({
    scene,
    engine,
    camera,
    getModel: () => currentModel,
    getExplode: () => explode,
    getStageController: () => stageController,
    getName: () => currentName,
    getMachineId: () => {
        const p = new URLSearchParams(location.search);
        return p.get('machineId') || p.get('machine') || 'machine_001';
    },
    loadFromFile,
    loadFromUrl: async (url: string, name?: string, headers?: Record<string, string>) => {
        if (isLoading) {
            toast(refs, 'Still loading, please wait.', 'warn');
            return;
        }
        isLoading = true;
        const resolvedName = name ?? url.split('/').pop()?.split('?')[0] ?? 'model.step';
        showProgress(refs, `Fetching ${resolvedName}\u2026`);
        try {
            const response = await fetch(url, headers ? { headers } : undefined);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${url}`);
            }
            const blob = await response.blob();
            showProgress(refs, `Loading ${resolvedName}\u2026`);
            await applyLoad(blob, resolvedName);
        } catch (err) {
            reportLoadError(err);
        } finally {
            isLoading = false;
            hideProgress(refs);
        }
    },
    clearScene,
    takeScreenshot: async () => {
        await downloadScreenshot(engine, camera, currentName);
    },
    onClearSelection: () => {
        picking.reset();
        currentFace = null;
        renderSelectionInfo(refs, null);
    },
});

bridge.notifyViewerReady();

// Autoload a model so the viewport is never empty on first paint.
// `?model=none` starts blank; `?model=<relative-url>` loads a custom file
// (relative only, so a link cannot point the viewer at a third-party host).
const params = new URLSearchParams(location.search);
const modelParam = params.get('model');
// Resolve before judging: a prefix test alone lets `\\evil.com/x.step` through,
// which the URL parser then resolves to a different origin.
const isSameOrigin = (url: string): boolean => {
    try {
        return new URL(url, location.href).origin === location.origin;
    } catch {
        return false;
    }
};
if (modelParam !== 'none') {
    const startup: SampleEntry | undefined = modelParam && isSameOrigin(modelParam)
        ? { label: modelParam.split('/').pop() ?? 'model', url: modelParam }
        : SAMPLES[0];
    if (startup) loadFromUrl(startup);
}

refs.btnScreenshot.addEventListener('click', async () => {
    try {
        await downloadScreenshot(engine, camera, currentName);
    } catch (err) {
        toast(refs, `Screenshot failed: ${(err as Error).message}`, 'error');
    }
});

refs.btnMeasure.addEventListener('click', () => {
    const next = !measure.isEnabled();
    measure.setEnabled(next);
    refs.btnMeasure.classList.toggle('is-active', next);
    if (next) {
        toast(refs, 'Click two surface points to measure.');
    }
});

// Continuous explosion slider support
refs.explodeSlider.addEventListener('input', () => {
    const factor = Number(refs.explodeSlider.value) / 100;
    if (stageController) {
        stageController.setContinuousFactor(factor);
    } else if (explode) {
        explode.setFactor(factor);
    }
    bridge?.notifyExplodeChanged(factor);
});

// Sequential Step Navigation Controls (Task 2)
refs.btnPrevStep.addEventListener('click', () => {
    stageController?.previousStep();
});

refs.btnNextStep.addEventListener('click', () => {
    stageController?.nextStep();
});

refs.btnResetStep.addEventListener('click', () => {
    stageController?.reset();
});

refs.stepSelect.addEventListener('change', () => {
    const selectedIdx = Number(refs.stepSelect.value);
    if (!Number.isNaN(selectedIdx)) {
        stageController?.goToStep(selectedIdx);
    }
});

// Debug hook, live in production too: `?debug` exposes the scene + engine on
// `window`. Unlike the inspector below there is no bundle cost to gate, and
// having it on the deployed build is what makes a bug report reproducible.
if (params.has('debug')) {
    (window as unknown as { __scene: typeof scene; __engine: typeof engine }).__scene = scene;
    (window as unknown as { __scene: typeof scene; __engine: typeof engine }).__engine = engine;
}

// import.meta.env.DEV is a compile-time constant, so the whole branch — and
// with it the inspector bundle — is dropped from the production build.
if (import.meta.env.DEV && params.has('inspector')) {
    import('@babylonjs/inspector')
        .then(({ Inspector }) => Inspector.Show(scene, { embedMode: true }))
        .catch((err) => toast(refs, `Inspector failed to load: ${(err as Error).message}`, 'error'));
}
