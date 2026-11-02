import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { BuiltModel } from './builder';
import type { ExplodeController } from './features/explode';
import type { StageController } from './features/stage-controller';
import type { ExplosionSequenceConfig, ExplosionStep } from './features/stage-config';
import { frameCamera } from './camera-frame';

export const CAD_PROTOCOL_VERSION = 1;

export const ALLOWED_COMMANDS = new Set<string>([
    'LOAD_ASSEMBLY',
    'NEXT_STEP',
    'PREVIOUS_STEP',
    'RESET_EXPLOSION',
    'GO_TO_STEP',
    'SELECT_COMPONENT',
    'CLEAR_SELECTION',
    'GET_VIEWER_STATE',
]);

export const ALLOWED_EVENTS = new Set<string>([
    'viewerReady',
    'assemblyLoaded',
    'componentSelected',
    'componentDeselected',
    'explosionStepChanged',
    'viewerError',
    'commandResult',
]);

export interface CadBridgeEventMessage {
    version: 1;
    type: 'event';
    event: string;
    requestId: string;
    machineId: string;
    viewerInstanceId?: string;
    payload: Record<string, unknown> | unknown;
    data?: unknown;
    timestamp?: number;
}

export interface CadBridgeResponseMessage {
    version: 1;
    type: 'response';
    event: 'commandResult';
    command: string;
    requestId: string;
    machineId: string;
    viewerInstanceId?: string;
    payload: {
        success: boolean;
        command: string;
        result?: unknown;
        error?: string;
    };
    data?: unknown;
}

export interface CadBridgeCommandMessage {
    version?: number;
    type?: string;
    command: string;
    requestId?: string;
    machineId?: string;
    viewerInstanceId?: string;
    payload?: Record<string, any>;
}

export interface ModelMetadata {
    name: string;
    meshCount: number;
    faceCount: number;
    partCount: number;
    parts: string[];
}

export interface AssemblyMetadata extends ModelMetadata {
    currentStep?: number;
    totalSteps?: number;
    isAutoInferred?: boolean;
    steps?: ExplosionStep[];
}

export interface SelectedPartData {
    nodeName: string;
    id: string;
    faceIndex?: number;
    meshName: string;
    description?: string;
    parentId?: string;
    assemblyPath?: string[];
    metadata?: Record<string, unknown>;
}

export interface CadViewerBridgeOptions {
    scene: Scene;
    engine: Engine;
    camera: ArcRotateCamera;
    getModel: () => BuiltModel | null;
    getExplode: () => ExplodeController | null;
    getStageController?: () => StageController | null;
    getName: () => string;
    getMachineId?: () => string;
    loadFromFile: (file: File | Blob, name: string) => Promise<void>;
    loadFromUrl: (url: string, name?: string, headers?: Record<string, string>) => Promise<void>;
    clearScene: () => void;
    takeScreenshot: () => Promise<void>;
    onClearSelection?: () => void;
}

export interface CadViewerBridge {
    loadModelFromUrl: (url: string, name?: string, headers?: Record<string, string>) => Promise<void>;
    loadModelFromBuffer: (buffer: ArrayBuffer, name: string) => Promise<void>;
    setExplode: (factor: number) => void;
    getExplode: () => number;
    framePart: (nodeName: string) => boolean;
    togglePartVisibility: (nodeName: string, visible: boolean) => boolean;
    resetCamera: () => void;
    clear: () => void;
    takeScreenshot: () => Promise<void>;
    isLoaded: () => boolean;
    getModelInfo: () => ModelMetadata | null;
    getMachineId: () => string;

    // Component Selection API (Task 4)
    selectComponent: (partId: string) => boolean;
    clearSelection: () => void;
    getSelectedComponent: () => SelectedPartData | null;

    // Sequential Explosion Stage API (Task 2 / Task 4)
    getCurrentStep: () => ExplosionStep | null;
    getTotalSteps: () => number;
    nextStep: () => boolean;
    previousStep: () => boolean;
    resetExplosion: () => void;
    goToStep: (stepIndex: number) => boolean;
    getAssemblyMetadata: () => AssemblyMetadata | null;
    setExplosionConfig: (config: unknown) => boolean;
    getExplosionConfig: () => ExplosionSequenceConfig | null;

    // Command handling (Task 4)
    handleCommand: (raw: string | CadBridgeCommandMessage) => Promise<CadBridgeResponseMessage> | CadBridgeResponseMessage;

    // Outbound notification hooks (Task 4 protocol)
    notifyViewerReady: () => void;
    notifyModelLoaded: (meta: ModelMetadata) => void;
    notifyPartSelected: (part: SelectedPartData | null) => void;
    notifyComponentDeselected: () => void;
    notifyExplodeChanged: (factor: number) => void;
    notifyError: (errorMessage: string) => void;
    notifyStepChanged: (step: ExplosionStep, index: number, total: number) => void;
    notifyAssemblyLoaded: (meta: AssemblyMetadata) => void;
}

function isMeshLike(node: unknown): node is Mesh {
    return node instanceof Mesh || (typeof node === 'object' && node !== null && typeof (node as { setEnabled?: unknown }).setEnabled === 'function');
}

function isNodeLike(node: unknown): node is TransformNode {
    return node instanceof TransformNode || (typeof node === 'object' && node !== null && typeof (node as { getChildren?: unknown }).getChildren === 'function');
}

function collectMeshesFromNode(node: TransformNode, out: Mesh[]): void {
    if (isMeshLike(node) && !out.includes(node)) {
        out.push(node);
    }
    for (const child of node.getChildren()) {
        if (isMeshLike(child)) {
            if (!out.includes(child)) out.push(child);
        } else if (isNodeLike(child)) {
            collectMeshesFromNode(child, out);
        }
    }
}

function findNodeByName(root: TransformNode, name: string): TransformNode | null {
    if (!root || !name) return null;
    if (root.name && root.name.toLowerCase() === name.toLowerCase()) {
        return root;
    }
    for (const child of root.getChildren()) {
        if (isNodeLike(child)) {
            const found = findNodeByName(child, name);
            if (found) return found;
        }
    }
    return null;
}

export function getAssemblyPath(node: TransformNode | null): string[] {
    const path: string[] = [];
    let curr: any = node;
    while (curr && curr.name) {
        path.unshift(curr.name);
        curr = curr.parent;
    }
    return path;
}

/**
 * Send raw data to all supported hosts.
 */
export function sendRawToHost(data: object, eventName?: string, payloadData?: unknown): void {
    const jsonStr = JSON.stringify(data);

    // 1. Flutter JavascriptChannel
    const flutterBridge = (window as unknown as { FlutterCADBridge?: { postMessage: (msg: string) => void } }).FlutterCADBridge;
    if (flutterBridge?.postMessage) {
        try {
            flutterBridge.postMessage(jsonStr);
        } catch (e) {
            console.warn('[CAD Bridge] FlutterCADBridge call failed:', e);
        }
    }

    // 2. Flutter InAppWebView handler
    const inAppWebView = (window as unknown as { flutter_inappwebview?: { callHandler: (h: string, ...args: unknown[]) => void } }).flutter_inappwebview;
    if (inAppWebView?.callHandler) {
        try {
            const evt = eventName || (data as any).event || 'FlutterCADBridge';
            const pay = payloadData !== undefined ? payloadData : ((data as any).payload !== undefined ? (data as any).payload : data);
            inAppWebView.callHandler(evt, pay);
        } catch (e) {
            console.warn('[CAD Bridge] flutter_inappwebview call failed:', e);
        }
    }

    // 3. PostMessage to parent frame if embedded in iframe
    if (window.parent && window.parent !== window) {
        const evt = eventName || (data as any).event;
        const pay = payloadData !== undefined ? payloadData : ((data as any).payload !== undefined ? (data as any).payload : data);
        window.parent.postMessage({ source: 'man-u-ai-cad-viewer', event: evt, payload: pay }, '*');
    }

    // 4. Local DOM event for web integration
    try {
        const evtName = eventName || (data as any).event || 'message';
        window.dispatchEvent(new CustomEvent(`cad:${evtName}`, { detail: data }));
    } catch {
        // Ignored in non-browser environments
    }
}

let activeViewerInstanceId: string | undefined = undefined;

export function setActiveViewerInstanceId(id: string | undefined): void {
    activeViewerInstanceId = id;
}

export function getActiveViewerInstanceId(): string | undefined {
    return activeViewerInstanceId;
}

/**
 * Dispatch structured versioned events to host.
 */
export function sendBridgeEvent(
    event: string,
    payload: unknown,
    machineId = 'machine_001',
    requestId?: string,
    viewerInstanceId?: string
): void {
    const msg: CadBridgeEventMessage = {
        version: 1,
        type: 'event',
        event,
        requestId: requestId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        machineId,
        viewerInstanceId: viewerInstanceId || activeViewerInstanceId,
        payload: payload ?? {},
        data: payload,
        timestamp: Date.now(),
    };
    sendRawToHost(msg);
}

/**
 * Dispatch outbound messages to Flutter WebView or Parent Window.
 * Retained for backward-compatibility.
 */
export function sendToHost(event: string, payload: unknown): void {
    sendBridgeEvent(event, payload);
}

/**
 * Initialize the CAD Viewer JavaScript Bridge.
 */
export function initCadBridge(options: CadViewerBridgeOptions): CadViewerBridge {
    const {
        camera,
        getModel,
        getExplode,
        getStageController,
        getName,
        getMachineId,
        loadFromFile,
        loadFromUrl,
        clearScene,
        takeScreenshot,
        onClearSelection,
    } = options;

    const bridge: CadViewerBridge = {
        getMachineId(): string {
            if (getMachineId) {
                const id = getMachineId();
                if (id) return id;
            }
            const stageCtrl = getStageController?.();
            if (stageCtrl && stageCtrl.getConfig().machineId) {
                return stageCtrl.getConfig().machineId;
            }
            return 'machine_001';
        },

        async loadModelFromUrl(url: string, name?: string, headers?: Record<string, string>): Promise<void> {
            const fileName = name || url.split('/').pop()?.split('?')[0] || 'model.step';
            await loadFromUrl(url, fileName, headers);
        },

        async loadModelFromBuffer(buffer: ArrayBuffer, name: string): Promise<void> {
            const blob = new Blob([buffer]);
            await loadFromFile(blob, name);
        },

        setExplode(factor: number): void {
            const stageCtrl = getStageController?.();
            if (stageCtrl) {
                stageCtrl.setContinuousFactor(factor);
            } else {
                const explode = getExplode();
                if (explode) explode.setFactor(factor);
            }
            bridge.notifyExplodeChanged(factor);
        },

        getExplode(): number {
            const explode = getExplode();
            if (explode) return explode.getFactor();
            const stageCtrl = getStageController?.();
            return stageCtrl ? stageCtrl.getCurrentStep().explodeFactor : 0;
        },

        framePart(nodeName: string): boolean {
            const model = getModel();
            if (!model) return false;
            const node = findNodeByName(model.root, nodeName);
            if (!node) return false;
            const meshes: Mesh[] = [];
            collectMeshesFromNode(node, meshes);
            if (meshes.length === 0) return false;
            try {
                frameCamera(camera, meshes);
            } catch {
                // Best-effort camera framing
            }
            return true;
        },

        togglePartVisibility(nodeName: string, visible: boolean): boolean {
            const model = getModel();
            if (!model) return false;
            const node = findNodeByName(model.root, nodeName);
            if (!node) return false;
            const meshes: Mesh[] = [];
            collectMeshesFromNode(node, meshes);
            for (const m of meshes) {
                m.setEnabled(visible);
            }
            return true;
        },

        resetCamera(): void {
            const model = getModel();
            if (model && model.meshes.length > 0) {
                frameCamera(camera, model.meshes);
            }
        },

        clear(): void {
            clearScene();
        },

        async takeScreenshot(): Promise<void> {
            await takeScreenshot();
        },

        isLoaded(): boolean {
            const model = getModel();
            return model !== null && model.meshes.length > 0;
        },

        getModelInfo(): ModelMetadata | null {
            const model = getModel();
            if (!model) return null;
            const explode = getExplode();
            const partNames: string[] = [];
            for (const child of model.topLevel) {
                if (child.name) partNames.push(child.name);
            }
            return {
                name: getName(),
                meshCount: model.meshes.length,
                faceCount: model.faces.size,
                partCount: explode?.partCount ?? model.topLevel.length,
                parts: partNames,
            };
        },

        selectComponent(partId: string): boolean {
            if (!partId) {
                bridge.clearSelection();
                return true;
            }
            const model = getModel();
            if (!model) return false;

            // Search by node name or mesh uniqueId
            const node = findNodeByName(model.root, partId);
            if (node) {
                const parentNode = node.parent instanceof TransformNode ? node.parent : null;
                const assemblyPath = getAssemblyPath(node);
                const partData: SelectedPartData = {
                    nodeName: node.name,
                    id: node.name,
                    meshName: node.name,
                    parentId: parentNode?.name || '',
                    assemblyPath,
                    metadata: {
                        nodeName: node.name,
                    },
                };
                const sc = getStageController?.();
                if (sc && typeof (sc as any).setSelectedComponent === 'function') {
                    (sc as any).setSelectedComponent(partData);
                }
                bridge.notifyPartSelected(partData);
                try {
                    bridge.framePart(node.name);
                } catch {
                    // Framing is best-effort and non-blocking
                }
                return true;
            }

            // Fallback search mesh
            for (const mesh of model.meshes) {
                if (mesh.name.toLowerCase() === partId.toLowerCase() || String(mesh.uniqueId) === partId) {
                    const parentNode = mesh.parent instanceof TransformNode ? mesh.parent : null;
                    const assemblyPath = getAssemblyPath(parentNode || (mesh as any));
                    const partData: SelectedPartData = {
                        nodeName: mesh.name,
                        id: String(mesh.uniqueId),
                        meshName: mesh.name,
                        parentId: parentNode?.name || '',
                        assemblyPath,
                        metadata: {
                            meshName: mesh.name,
                            uniqueId: mesh.uniqueId,
                        },
                    };
                    const sc = getStageController?.();
                    if (sc && typeof (sc as any).setSelectedComponent === 'function') {
                        (sc as any).setSelectedComponent(partData);
                    }
                    bridge.notifyPartSelected(partData);
                    try {
                        frameCamera(camera, [mesh]);
                    } catch {
                        // Best-effort camera framing
                    }
                    return true;
                }
            }

            return false;
        },

        clearSelection(): void {
            const sc = getStageController?.();
            if (sc && typeof (sc as any).setSelectedComponent === 'function') {
                (sc as any).setSelectedComponent(null);
            }
            if (onClearSelection) {
                onClearSelection();
            }
            bridge.notifyComponentDeselected();
        },

        getCurrentStep(): ExplosionStep | null {
            const sc = getStageController?.();
            return sc ? sc.getCurrentStep() : null;
        },

        getTotalSteps(): number {
            const sc = getStageController?.();
            return sc ? sc.getTotalSteps() : 0;
        },

        nextStep(): boolean {
            const sc = getStageController?.();
            return sc ? sc.nextStep() : false;
        },

        previousStep(): boolean {
            const sc = getStageController?.();
            return sc ? sc.previousStep() : false;
        },

        resetExplosion(): void {
            const sc = getStageController?.();
            if (sc) {
                sc.reset();
            } else {
                bridge.setExplode(0);
            }
        },

        goToStep(stepIndex: number): boolean {
            const sc = getStageController?.();
            return sc ? sc.goToStep(stepIndex) : false;
        },

        getSelectedComponent(): SelectedPartData | null {
            const sc = getStageController?.();
            return sc ? sc.getSelectedComponent() : null;
        },

        getAssemblyMetadata(): AssemblyMetadata | null {
            const baseInfo = bridge.getModelInfo();
            if (!baseInfo) return null;
            const sc = getStageController?.();
            return {
                ...baseInfo,
                currentStep: sc ? sc.getCurrentStepIndex() + 1 : 1,
                totalSteps: sc ? sc.getTotalSteps() : 1,
                isAutoInferred: sc ? sc.getConfig().isAutoInferred : true,
                steps: sc ? sc.getConfig().explosionSteps : [],
            };
        },

        setExplosionConfig(config: unknown): boolean {
            const sc = getStageController?.();
            return sc ? sc.setConfig(config) : false;
        },

        getExplosionConfig(): ExplosionSequenceConfig | null {
            const sc = getStageController?.();
            return sc ? sc.getConfig() : null;
        },

        async handleCommand(raw: string | CadBridgeCommandMessage): Promise<CadBridgeResponseMessage> {
            let cmd: CadBridgeCommandMessage;
            if (typeof raw === 'string') {
                if (raw.length > 65536) {
                    const errResp: CadBridgeResponseMessage = {
                        version: 1,
                        type: 'response',
                        event: 'commandResult',
                        command: 'UNKNOWN',
                        requestId: 'err_oversized',
                        machineId: bridge.getMachineId(),
                        payload: {
                            success: false,
                            command: 'UNKNOWN',
                            error: 'Message size exceeds limit (64KB)',
                        },
                        data: { success: false, error: 'Message size exceeds limit (64KB)' },
                    };
                    sendRawToHost(errResp);
                    return errResp;
                }
                try {
                    cmd = JSON.parse(raw);
                } catch {
                    const errResp: CadBridgeResponseMessage = {
                        version: 1,
                        type: 'response',
                        event: 'commandResult',
                        command: 'UNKNOWN',
                        requestId: 'err_malformed',
                        machineId: bridge.getMachineId(),
                        payload: {
                            success: false,
                            command: 'UNKNOWN',
                            error: 'Malformed JSON command',
                        },
                        data: { success: false, error: 'Malformed JSON command' },
                    };
                    sendRawToHost(errResp);
                    return errResp;
                }
            } else if (raw && typeof raw === 'object') {
                cmd = raw;
            } else {
                const errResp: CadBridgeResponseMessage = {
                    version: 1,
                    type: 'response',
                    event: 'commandResult',
                    command: 'UNKNOWN',
                    requestId: 'err_invalid_type',
                    machineId: bridge.getMachineId(),
                    payload: {
                        success: false,
                        command: 'UNKNOWN',
                        error: 'Command must be a valid JSON object',
                    },
                    data: { success: false, error: 'Command must be a valid JSON object' },
                };
                sendRawToHost(errResp);
                return errResp;
            }

            const command = (cmd.command || '').toUpperCase();
            const requestId = cmd.requestId || `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const machineId = cmd.machineId || bridge.getMachineId();
            if (cmd.viewerInstanceId) {
                activeViewerInstanceId = cmd.viewerInstanceId;
            }

            if (cmd.version !== undefined && cmd.version !== 1) {
                const errResp: CadBridgeResponseMessage = {
                    version: 1,
                    type: 'response',
                    event: 'commandResult',
                    command,
                    requestId,
                    machineId,
                    payload: {
                        success: false,
                        command,
                        error: `Unsupported protocol version: ${cmd.version}`,
                    },
                    data: { success: false, error: `Unsupported protocol version: ${cmd.version}` },
                };
                sendRawToHost(errResp);
                return errResp;
            }

            if (!ALLOWED_COMMANDS.has(command)) {
                const errResp: CadBridgeResponseMessage = {
                    version: 1,
                    type: 'response',
                    event: 'commandResult',
                    command,
                    requestId,
                    machineId,
                    payload: {
                        success: false,
                        command,
                        error: `Disallowed or unknown command: ${command}`,
                    },
                    data: { success: false, error: `Disallowed or unknown command: ${command}` },
                };
                sendRawToHost(errResp);
                return errResp;
            }

            try {
                let result: unknown = null;
                switch (command) {
                    case 'NEXT_STEP': {
                        const success = bridge.nextStep();
                        result = { success, currentStep: bridge.getCurrentStep()?.stepNumber ?? 1, totalSteps: bridge.getTotalSteps() };
                        break;
                    }
                    case 'PREVIOUS_STEP': {
                        const success = bridge.previousStep();
                        result = { success, currentStep: bridge.getCurrentStep()?.stepNumber ?? 1, totalSteps: bridge.getTotalSteps() };
                        break;
                    }
                    case 'RESET_EXPLOSION': {
                        bridge.resetExplosion();
                        result = { success: true, currentStep: 1, totalSteps: bridge.getTotalSteps() };
                        break;
                    }
                    case 'GO_TO_STEP': {
                        const stepIdx = Number(cmd.payload?.stepIndex ?? cmd.payload?.step ?? 0);
                        const success = bridge.goToStep(stepIdx);
                        result = { success, stepIndex: stepIdx, totalSteps: bridge.getTotalSteps() };
                        break;
                    }
                    case 'SELECT_COMPONENT': {
                        const partId = String(cmd.payload?.partId ?? '');
                        const success = bridge.selectComponent(partId);
                        result = { success, partId };
                        break;
                    }
                    case 'CLEAR_SELECTION': {
                        bridge.clearSelection();
                        result = { success: true };
                        break;
                    }
                    case 'LOAD_ASSEMBLY': {
                        const url = String(cmd.payload?.url ?? '');
                        const name = cmd.payload?.name ? String(cmd.payload.name) : undefined;
                        const headers = cmd.payload?.headers;
                        await bridge.loadModelFromUrl(url, name, headers);
                        result = { success: true, url, name };
                        break;
                    }
                    case 'GET_VIEWER_STATE': {
                        result = {
                            isLoaded: bridge.isLoaded(),
                            machineId,
                            currentStep: bridge.getCurrentStep()?.stepNumber ?? 1,
                            totalSteps: bridge.getTotalSteps(),
                            selectedComponent: bridge.getSelectedComponent(),
                            explodeFactor: bridge.getExplode(),
                        };
                        break;
                    }
                }

                const response: CadBridgeResponseMessage = {
                    version: 1,
                    type: 'response',
                    event: 'commandResult',
                    command,
                    requestId,
                    machineId,
                    payload: {
                        success: true,
                        command,
                        result,
                    },
                    data: { success: true, command, result },
                };
                sendRawToHost(response);
                return response;
            } catch (err) {
                const errMsg = (err as Error)?.message || String(err);
                const response: CadBridgeResponseMessage = {
                    version: 1,
                    type: 'response',
                    event: 'commandResult',
                    command,
                    requestId,
                    machineId,
                    payload: {
                        success: false,
                        command,
                        error: errMsg,
                    },
                    data: { success: false, command, error: errMsg },
                };
                sendRawToHost(response);
                return response;
            }
        },

        notifyViewerReady(): void {
            const machineId = bridge.getMachineId();
            sendBridgeEvent('viewerReady', { status: 'ready', capabilities: ['stages', 'picking', 'explode'] }, machineId);
        },

        notifyModelLoaded(meta: ModelMetadata): void {
            const machineId = bridge.getMachineId();
            sendBridgeEvent('onModelLoaded', meta, machineId);
        },

        notifyPartSelected(part: SelectedPartData | null): void {
            const machineId = bridge.getMachineId();
            if (part) {
                const payload = {
                    partId: part.id || part.nodeName,
                    partName: part.nodeName || part.meshName || 'Component',
                    parentId: part.parentId || '',
                    assemblyPath: part.assemblyPath || (part.nodeName ? [part.nodeName] : []),
                    metadata: part.metadata || {},
                };
                sendBridgeEvent('componentSelected', payload, machineId);
            } else {
                bridge.notifyComponentDeselected();
            }
        },

        notifyComponentDeselected(): void {
            const machineId = bridge.getMachineId();
            sendBridgeEvent('componentDeselected', {}, machineId);
        },

        notifyExplodeChanged(factor: number): void {
            const machineId = bridge.getMachineId();
            sendBridgeEvent('onExplodeChanged', { factor }, machineId);
        },

        notifyStepChanged(step: ExplosionStep, index: number, total: number): void {
            const machineId = bridge.getMachineId();
            sendBridgeEvent('explosionStepChanged', {
                stepIndex: index,
                stepNumber: index + 1,
                totalSteps: total,
                step,
            }, machineId);
        },

        notifyAssemblyLoaded(meta: AssemblyMetadata): void {
            const machineId = bridge.getMachineId();
            sendBridgeEvent('assemblyLoaded', meta, machineId);
            sendToHost('onModelLoaded', meta);
        },

        notifyError(errorMessage: string): void {
            const machineId = bridge.getMachineId();
            sendBridgeEvent('viewerError', { error: errorMessage }, machineId);
        },
    };

    // Attach to window object for Flutter WebViewController.runJavaScript
    (window as unknown as { cadViewer: CadViewerBridge }).cadViewer = bridge;

    // Listen to inbound postMessages from parent frames / WebView
    window.addEventListener('message', async (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        // Structured command message (version 1 protocol)
        if (data.command || data.type === 'command') {
            await bridge.handleCommand(data);
            return;
        }

        // Backward-compatible CAD_* commands
        switch (data.type) {
            case 'CAD_LOAD_URL':
                if (typeof data.url === 'string') {
                    bridge.loadModelFromUrl(data.url, data.name, data.headers).catch((err) => {
                        bridge.notifyError((err as Error).message);
                    });
                }
                break;
            case 'CAD_SET_EXPLODE':
                if (typeof data.factor === 'number') {
                    bridge.setExplode(data.factor);
                }
                break;
            case 'CAD_FRAME_PART':
                if (typeof data.name === 'string') {
                    bridge.framePart(data.name);
                }
                break;
            case 'CAD_RESET_CAMERA':
                bridge.resetCamera();
                break;
            case 'CAD_TOGGLE_PART':
                if (typeof data.name === 'string' && typeof data.visible === 'boolean') {
                    bridge.togglePartVisibility(data.name, data.visible);
                }
                break;
            case 'CAD_NEXT_STEP':
                bridge.nextStep();
                break;
            case 'CAD_PREV_STEP':
                bridge.previousStep();
                break;
            case 'CAD_RESET_STEP':
                bridge.resetExplosion();
                break;
            case 'CAD_GO_TO_STEP':
                if (typeof data.stepIndex === 'number') {
                    bridge.goToStep(data.stepIndex);
                }
                break;
            case 'CAD_SET_EXPLOSION_CONFIG':
                if (data.config) {
                    bridge.setExplosionConfig(data.config);
                }
                break;
        }
    });

    return bridge;
}
