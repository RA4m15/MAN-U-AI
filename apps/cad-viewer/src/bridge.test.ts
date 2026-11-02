import { describe, expect, it, vi, beforeEach } from 'vitest';
import { initCadBridge, sendToHost, type CadViewerBridgeOptions } from './bridge';
import type { BuiltModel } from './builder';
import type { ExplodeController } from './features/explode';
import type { StageController } from './features/stage-controller';
import type { ExplosionStep } from './features/stage-config';

describe('CAD Viewer Bridge', () => {
    let mockWindow: any;
    let mockParent: any;
    let mockFlutterBridge: any;
    let mockInAppWebView: any;
    let mockCamera: any;
    let mockScene: any;
    let mockEngine: any;
    let mockModel: any;
    let mockExplode: any;
    let mockStageController: any;
    let mockOptions: CadViewerBridgeOptions;

    beforeEach(() => {
        mockFlutterBridge = { postMessage: vi.fn() };
        mockInAppWebView = { callHandler: vi.fn() };
        mockParent = { postMessage: vi.fn() };

        const listeners: Record<string, ((e: any) => void)[]> = {};

        mockWindow = {
            FlutterCADBridge: mockFlutterBridge,
            flutter_inappwebview: mockInAppWebView,
            parent: mockParent,
            addEventListener: vi.fn((type: string, cb: any) => {
                listeners[type] = listeners[type] || [];
                listeners[type].push(cb);
            }),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn((event: any) => {
                const list = listeners[event.type] || [];
                list.forEach((cb) => cb(event));
                return true;
            }),
            _listeners: listeners,
        };

        // Assign global window for test runtime
        (globalThis as any).window = mockWindow;
        (globalThis as any).CustomEvent = class CustomEvent {
            type: string;
            detail: any;
            constructor(type: string, opts?: { detail?: any }) {
                this.type = type;
                this.detail = opts?.detail;
            }
        };

        mockCamera = {
            target: { x: 0, y: 0, z: 0 },
            radius: 10,
        };
        mockScene = {};
        mockEngine = {};

        const mockMesh1 = {
            name: 'Part1_mesh',
            setEnabled: vi.fn(),
            getChildren: () => [],
            computeWorldMatrix: vi.fn(),
            getBoundingInfo: () => ({
                boundingBox: {
                    minimumWorld: { x: -1, y: -1, z: -1 },
                    maximumWorld: { x: 1, y: 1, z: 1 },
                },
            }),
        };

        const mockPartNode = {
            name: 'HydraulicCylinder',
            getChildren: () => [mockMesh1],
        };

        const mockRoot = {
            name: 'Root',
            getChildren: () => [mockPartNode],
        };

        mockModel = {
            root: mockRoot,
            topLevel: [mockPartNode],
            meshes: [mockMesh1],
            faces: new Map([
                [1, { mesh: mockMesh1, faceIndex: 0 }],
                [2, { mesh: mockMesh1, faceIndex: 1 }],
            ]),
        } as unknown as BuiltModel;

        mockExplode = {
            partCount: 4,
            getFactor: vi.fn(() => 0.5),
            setFactor: vi.fn(),
        } as unknown as ExplodeController;

        const dummyStep: ExplosionStep = {
            id: 'step_01',
            stepNumber: 1,
            title: 'Complete Assembly',
            description: 'Baseline view.',
            componentIds: [],
            explodeFactor: 0,
        };

        mockStageController = {
            getCurrentStep: vi.fn(() => dummyStep),
            getCurrentStepIndex: vi.fn(() => 0),
            getTotalSteps: vi.fn(() => 3),
            nextStep: vi.fn(() => true),
            previousStep: vi.fn(() => true),
            reset: vi.fn(),
            goToStep: vi.fn((_idx: number) => true),
            setSelectedComponent: vi.fn(),
            getSelectedComponent: vi.fn(() => ({
                nodeName: 'HydraulicCylinder',
                id: 'part_123',
                meshName: 'Part1_mesh',
            })),
            getConfig: vi.fn(() => ({
                machineId: 'machine_001',
                isAutoInferred: false,
                explosionSteps: [dummyStep],
            })),
            setConfig: vi.fn(() => true),
            setContinuousFactor: vi.fn(),
        } as unknown as StageController;

        mockOptions = {
            scene: mockScene,
            engine: mockEngine,
            camera: mockCamera,
            getModel: vi.fn(() => mockModel),
            getExplode: vi.fn(() => mockExplode),
            getStageController: vi.fn(() => mockStageController),
            getName: vi.fn(() => 'TestMachine'),
            loadFromFile: vi.fn().mockResolvedValue(undefined),
            loadFromUrl: vi.fn().mockResolvedValue(undefined),
            clearScene: vi.fn(),
            takeScreenshot: vi.fn().mockResolvedValue(undefined),
        };
    });

    it('attaches bridge to window.cadViewer upon initialization', () => {
        const bridge = initCadBridge(mockOptions);
        expect(mockWindow.cadViewer).toBe(bridge);
        expect(typeof bridge.loadModelFromUrl).toBe('function');
        expect(typeof bridge.loadModelFromBuffer).toBe('function');
        expect(typeof bridge.setExplode).toBe('function');
        expect(typeof bridge.framePart).toBe('function');
        expect(typeof bridge.nextStep).toBe('function');
        expect(typeof bridge.previousStep).toBe('function');
        expect(typeof bridge.goToStep).toBe('function');
        expect(typeof bridge.resetExplosion).toBe('function');
    });

    it('reports loaded status and model metadata correctly', () => {
        const bridge = initCadBridge(mockOptions);
        expect(bridge.isLoaded()).toBe(true);

        const info = bridge.getModelInfo();
        expect(info).not.toBeNull();
        expect(info?.name).toBe('TestMachine');
        expect(info?.meshCount).toBe(1);
        expect(info?.faceCount).toBe(2);
        expect(info?.partCount).toBe(4);
        expect(info?.parts).toContain('HydraulicCylinder');
    });

    it('delegates sequential stage methods to StageController', () => {
        const bridge = initCadBridge(mockOptions);

        expect(bridge.getCurrentStep()?.title).toBe('Complete Assembly');
        expect(bridge.getTotalSteps()).toBe(3);

        const nextRes = bridge.nextStep();
        expect(nextRes).toBe(true);
        expect(mockStageController.nextStep).toHaveBeenCalled();

        const prevRes = bridge.previousStep();
        expect(prevRes).toBe(true);
        expect(mockStageController.previousStep).toHaveBeenCalled();

        bridge.resetExplosion();
        expect(mockStageController.reset).toHaveBeenCalled();

        const gotoRes = bridge.goToStep(2);
        expect(gotoRes).toBe(true);
        expect(mockStageController.goToStep).toHaveBeenCalledWith(2);

        const selected = bridge.getSelectedComponent();
        expect(selected?.nodeName).toBe('HydraulicCylinder');

        const metadata = bridge.getAssemblyMetadata();
        expect(metadata).not.toBeNull();
        expect(metadata?.totalSteps).toBe(3);
        expect(metadata?.currentStep).toBe(1);
    });

    it('dispatches sequential stage events via sendToHost', () => {
        const bridge = initCadBridge(mockOptions);

        const step: ExplosionStep = {
            id: 'step_02',
            stepNumber: 2,
            title: 'Outer Separation',
            description: 'Outer parts separated.',
            componentIds: ['HydraulicCylinder'],
            explodeFactor: 0.5,
        };

        bridge.notifyStepChanged(step, 1, 3);
        expect(mockFlutterBridge.postMessage).toHaveBeenCalled();
        const call = JSON.parse(mockFlutterBridge.postMessage.mock.calls.slice(-1)[0][0]);
        expect(call.event).toBe('explosionStepChanged');
        expect(call.data.stepIndex).toBe(1);
        expect(call.data.totalSteps).toBe(3);
        expect(call.data.step.title).toBe('Outer Separation');
    });

    it('dispatches outbound events across all supported hosts via sendToHost', () => {
        sendToHost('testEvent', { foo: 'bar' });

        // 1. Flutter JavascriptChannel
        expect(mockFlutterBridge.postMessage).toHaveBeenCalled();
        const flutterData = JSON.parse(mockFlutterBridge.postMessage.mock.calls[0][0]);
        expect(flutterData.event).toBe('testEvent');
        expect(flutterData.data).toEqual({ foo: 'bar' });

        // 2. Flutter InAppWebView
        expect(mockInAppWebView.callHandler).toHaveBeenCalledWith('testEvent', { foo: 'bar' });

        // 3. Parent window postMessage
        expect(mockParent.postMessage).toHaveBeenCalledWith(
            { source: 'man-u-ai-cad-viewer', event: 'testEvent', payload: { foo: 'bar' } },
            '*'
        );

        // 4. Custom DOM Event
        expect(mockWindow.dispatchEvent).toHaveBeenCalled();
    });

    it('toggles component visibility by node name', () => {
        const bridge = initCadBridge(mockOptions);

        const success = bridge.togglePartVisibility('HydraulicCylinder', false);
        expect(success).toBe(true);
        expect(mockModel.meshes[0].setEnabled).toHaveBeenCalledWith(false);

        const notFound = bridge.togglePartVisibility('NonExistentPart', false);
        expect(notFound).toBe(false);
    });

    it('clears and takes screenshot via options delegates', async () => {
        const bridge = initCadBridge(mockOptions);

        bridge.clear();
        expect(mockOptions.clearScene).toHaveBeenCalled();

        await bridge.takeScreenshot();
        expect(mockOptions.takeScreenshot).toHaveBeenCalled();
    });

    it('handles inbound postMessage actions from WebView / parent frame', async () => {
        const bridge = initCadBridge(mockOptions);
        expect(bridge).toBeDefined();
        const messageHandler = mockWindow._listeners['message']?.[0];
        expect(typeof messageHandler).toBe('function');

        // Test CAD_SET_EXPLODE
        messageHandler({ data: { type: 'CAD_SET_EXPLODE', factor: 0.3 } });
        expect(mockStageController.setContinuousFactor).toHaveBeenCalledWith(0.3);

        // Test CAD_NEXT_STEP
        messageHandler({ data: { type: 'CAD_NEXT_STEP' } });
        expect(mockStageController.nextStep).toHaveBeenCalled();

        // Test CAD_PREV_STEP
        messageHandler({ data: { type: 'CAD_PREV_STEP' } });
        expect(mockStageController.previousStep).toHaveBeenCalled();

        // Test CAD_RESET_STEP
        messageHandler({ data: { type: 'CAD_RESET_STEP' } });
        expect(mockStageController.reset).toHaveBeenCalled();

        // Test CAD_GO_TO_STEP
        messageHandler({ data: { type: 'CAD_GO_TO_STEP', stepIndex: 1 } });
        expect(mockStageController.goToStep).toHaveBeenCalledWith(1);

        // Test CAD_LOAD_URL
        messageHandler({ data: { type: 'CAD_LOAD_URL', url: '/models/pump.step', name: 'Pump' } });
        expect(mockOptions.loadFromUrl).toHaveBeenCalledWith('/models/pump.step', 'Pump', undefined);
    });

    describe('Task 4: Bidirectional Bridge Protocol Tests', () => {
        it('dispatches viewerReady event conforming to versioned protocol', () => {
            const bridge = initCadBridge(mockOptions);
            bridge.notifyViewerReady();

            expect(mockFlutterBridge.postMessage).toHaveBeenCalled();
            const call = JSON.parse(mockFlutterBridge.postMessage.mock.calls.slice(-1)[0][0]);
            expect(call.version).toBe(1);
            expect(call.type).toBe('event');
            expect(call.event).toBe('viewerReady');
            expect(call.machineId).toBe('machine_001');
            expect(call.payload.status).toBe('ready');
            expect(call.payload.capabilities).toContain('stages');
            expect(call.payload.capabilities).toContain('picking');
        });

        it('dispatches structured componentSelected and componentDeselected events', () => {
            const bridge = initCadBridge(mockOptions);

            bridge.notifyPartSelected({
                nodeName: 'HydraulicCylinder',
                id: 'cyl_001',
                faceIndex: 0,
                meshName: 'Part1_mesh',
                parentId: 'Root',
                assemblyPath: ['Root', 'HydraulicCylinder'],
                metadata: { unit: 'metric' },
            });

            const selectCall = JSON.parse(mockFlutterBridge.postMessage.mock.calls.slice(-1)[0][0]);
            expect(selectCall.version).toBe(1);
            expect(selectCall.type).toBe('event');
            expect(selectCall.event).toBe('componentSelected');
            expect(selectCall.payload.partId).toBe('cyl_001');
            expect(selectCall.payload.partName).toBe('HydraulicCylinder');
            expect(selectCall.payload.parentId).toBe('Root');
            expect(selectCall.payload.assemblyPath).toEqual(['Root', 'HydraulicCylinder']);

            // Deselect
            bridge.notifyPartSelected(null);
            const deselectCall = JSON.parse(mockFlutterBridge.postMessage.mock.calls.slice(-1)[0][0]);
            expect(deselectCall.event).toBe('componentDeselected');
            expect(deselectCall.payload).toEqual({});
        });

        it('executes NEXT_STEP, PREVIOUS_STEP, RESET_EXPLOSION, GO_TO_STEP via handleCommand', async () => {
            const bridge = initCadBridge(mockOptions);

            const nextResp = await bridge.handleCommand({
                version: 1,
                command: 'NEXT_STEP',
                requestId: 'req_next',
            });
            expect(nextResp.payload.success).toBe(true);
            expect(nextResp.command).toBe('NEXT_STEP');
            expect(mockStageController.nextStep).toHaveBeenCalled();

            const prevResp = await bridge.handleCommand({
                version: 1,
                command: 'PREVIOUS_STEP',
                requestId: 'req_prev',
            });
            expect(prevResp.payload.success).toBe(true);
            expect(mockStageController.previousStep).toHaveBeenCalled();

            const resetResp = await bridge.handleCommand({
                version: 1,
                command: 'RESET_EXPLOSION',
                requestId: 'req_reset',
            });
            expect(resetResp.payload.success).toBe(true);
            expect(mockStageController.reset).toHaveBeenCalled();

            const gotoResp = await bridge.handleCommand({
                version: 1,
                command: 'GO_TO_STEP',
                requestId: 'req_goto',
                payload: { stepIndex: 2 },
            });
            expect(gotoResp.payload.success).toBe(true);
            expect(mockStageController.goToStep).toHaveBeenCalledWith(2);
        });

        it('executes SELECT_COMPONENT and CLEAR_SELECTION via handleCommand', async () => {
            const bridge = initCadBridge(mockOptions);

            const selectResp = await bridge.handleCommand({
                version: 1,
                command: 'SELECT_COMPONENT',
                requestId: 'req_sel',
                payload: { partId: 'HydraulicCylinder' },
            });
            expect(selectResp.payload.success).toBe(true);
            expect(mockStageController.setSelectedComponent).toHaveBeenCalled();

            const clearResp = await bridge.handleCommand({
                version: 1,
                command: 'CLEAR_SELECTION',
                requestId: 'req_clear',
            });
            expect(clearResp.payload.success).toBe(true);
            expect(mockStageController.setSelectedComponent).toHaveBeenCalledWith(null);
        });

        it('executes GET_VIEWER_STATE returning complete viewer state', async () => {
            const bridge = initCadBridge(mockOptions);

            const stateResp = await bridge.handleCommand({
                version: 1,
                command: 'GET_VIEWER_STATE',
                requestId: 'req_state',
            });
            expect(stateResp.payload.success).toBe(true);
            const state = stateResp.payload.result as any;
            expect(state.isLoaded).toBe(true);
            expect(state.totalSteps).toBe(3);
            expect(state.machineId).toBe('machine_001');
        });

        it('rejects unsupported protocol versions', async () => {
            const bridge = initCadBridge(mockOptions);

            const errResp = await bridge.handleCommand({
                version: 99,
                command: 'NEXT_STEP',
            });
            expect(errResp.payload.success).toBe(false);
            expect(errResp.payload.error).toContain('Unsupported protocol version: 99');
        });

        it('rejects disallowed or unknown commands', async () => {
            const bridge = initCadBridge(mockOptions);

            const errResp = await bridge.handleCommand({
                version: 1,
                command: 'DROP_DATABASE',
            });
            expect(errResp.payload.success).toBe(false);
            expect(errResp.payload.error).toContain('Disallowed or unknown command');
        });

        it('rejects oversized command strings (> 64KB)', async () => {
            const bridge = initCadBridge(mockOptions);

            const oversized = JSON.stringify({
                version: 1,
                command: 'NEXT_STEP',
                payload: { data: 'a'.repeat(70000) },
            });

            const errResp = await bridge.handleCommand(oversized);
            expect(errResp.payload.success).toBe(false);
            expect(errResp.payload.error).toContain('Message size exceeds limit');
        });
    });
});
