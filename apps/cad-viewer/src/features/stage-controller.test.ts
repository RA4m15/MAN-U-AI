import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StageController } from './stage-controller';
import { validateExplosionConfig, generateAutoExplosionConfig, type ExplosionSequenceConfig } from './stage-config';
import type { BuiltModel } from '../builder';

describe('Stage Controller & Configuration Suite', () => {
    let mockScene: any;
    let mockModel: BuiltModel;
    let mockMesh1: any;
    let mockMesh2: any;
    let mockMesh3: any;
    let mockPart1: any;
    let mockPart2: any;
    let mockPart3: any;

    beforeEach(() => {
        mockScene = {
            onBeforeRenderObservable: {
                add: vi.fn(),
                remove: vi.fn(),
            },
        };

        const makeMesh = (name: string, min: Vector3, max: Vector3) => ({
            name,
            uniqueId: Math.floor(Math.random() * 10000),
            position: Vector3.Zero(),
            setEnabled: vi.fn(),
            computeWorldMatrix: vi.fn(),
            getChildren: () => [],
            getBoundingInfo: () => ({
                boundingBox: {
                    minimumWorld: min,
                    maximumWorld: max,
                    centerWorld: Vector3.Center(min, max),
                },
            }),
        });

        // Part 1: Outer Housing (min: -10, max: 10, offset from center)
        mockMesh1 = makeMesh('Housing_Mesh', new Vector3(8, 0, 0), new Vector3(12, 4, 4));
        mockPart1 = {
            name: 'Housing',
            uniqueId: 101,
            position: new Vector3(0, 0, 0),
            getChildren: () => [mockMesh1],
        };

        // Part 2: Intermediate Bracket
        mockMesh2 = makeMesh('Bracket_Mesh', new Vector3(3, 0, 0), new Vector3(7, 4, 4));
        mockPart2 = {
            name: 'Bracket',
            uniqueId: 102,
            position: new Vector3(0, 0, 0),
            getChildren: () => [mockMesh2],
        };

        // Part 3: Inner Rotor / Core
        mockMesh3 = makeMesh('Rotor_Mesh', new Vector3(-2, -2, -2), new Vector3(2, 2, 2));
        mockPart3 = {
            name: 'Rotor',
            uniqueId: 103,
            position: new Vector3(0, 0, 0),
            getChildren: () => [mockMesh3],
        };

        const mockRoot = {
            name: 'MachineRoot',
            getChildren: () => [mockPart1, mockPart2, mockPart3],
        };

        mockModel = {
            root: mockRoot as any,
            topLevel: [mockPart1, mockPart2, mockPart3],
            meshes: [mockMesh1, mockMesh2, mockMesh3],
            faces: new Map(),
            meshSet: new Set([mockMesh1, mockMesh2, mockMesh3]),
        };
    });

    it('1. Initial machine assembly loads without explosion at baseline', () => {
        const controller = new StageController(mockScene, mockModel);
        expect(controller.getCurrentStepIndex()).toBe(0);
        expect(controller.getCurrentStep().explodeFactor).toBe(0);
        expect(controller.getCurrentStep().title).toContain('Complete Assembly');

        // Initial positions should remain at home (0,0,0)
        expect(mockPart1.position.x).toBe(0);
        expect(mockPart2.position.x).toBe(0);
        expect(mockPart3.position.x).toBe(0);
    });

    it('2. Next Step advances exactly one stage and updates component positions', () => {
        const controller = new StageController(mockScene, mockModel);
        const total = controller.getTotalSteps();
        expect(total).toBeGreaterThanOrEqual(2);

        const advanced = controller.nextStep(false);
        expect(advanced).toBe(true);
        expect(controller.getCurrentStepIndex()).toBe(1);

        const step2 = controller.getCurrentStep();
        expect(step2.stepNumber).toBe(2);
        expect(step2.explodeFactor).toBeGreaterThan(0);

        // Affected components should have moved outward
        const affectedPart = step2.componentIds.includes('Housing') ? mockPart1 : mockPart2;
        expect(affectedPart.position.lengthSquared()).toBeGreaterThan(0);
    });

    it('3. Previous Step restores the previous stage exactly', () => {
        const controller = new StageController(mockScene, mockModel);

        controller.nextStep(false); // Go to step 1
        expect(controller.getCurrentStepIndex()).toBe(1);

        const retreated = controller.previousStep(false); // Back to step 0
        expect(retreated).toBe(true);
        expect(controller.getCurrentStepIndex()).toBe(0);

        // Returned to baseline
        expect(mockPart1.position.x).toBeCloseTo(0, 4);
        expect(mockPart2.position.x).toBeCloseTo(0, 4);
        expect(mockPart3.position.x).toBeCloseTo(0, 4);
    });

    it('4. Reset restores the original assembly from any stage', () => {
        const controller = new StageController(mockScene, mockModel);

        controller.goToStep(controller.getTotalSteps() - 1, false);
        expect(controller.getCurrentStepIndex()).toBe(controller.getTotalSteps() - 1);

        controller.reset(false);
        expect(controller.getCurrentStepIndex()).toBe(0);
        expect(mockPart1.position.x).toBeCloseTo(0, 4);
        expect(mockPart2.position.x).toBeCloseTo(0, 4);
        expect(mockPart3.position.x).toBeCloseTo(0, 4);
    });

    it('5. Direct step selection works accurately with bounds checks', () => {
        const controller = new StageController(mockScene, mockModel);

        // Valid jump
        const success = controller.goToStep(2, false);
        expect(success).toBe(true);
        expect(controller.getCurrentStepIndex()).toBe(2);

        // Out-of-bounds jump rejected
        const invalidNegative = controller.goToStep(-1, false);
        expect(invalidNegative).toBe(false);
        expect(controller.getCurrentStepIndex()).toBe(2);

        const invalidTooHigh = controller.goToStep(999, false);
        expect(invalidTooHigh).toBe(false);
        expect(controller.getCurrentStepIndex()).toBe(2);
    });

    it('6. Component selection works and persists metadata across stage navigation', () => {
        const controller = new StageController(mockScene, mockModel);

        controller.setSelectedComponent({
            nodeName: 'Housing',
            id: '101',
            meshName: 'Housing_Mesh',
            faceIndex: 5,
            description: 'Cast aluminum motor housing',
        });

        const selectedBefore = controller.getSelectedComponent();
        expect(selectedBefore?.nodeName).toBe('Housing');
        expect(selectedBefore?.faceIndex).toBe(5);

        // Advance through steps
        controller.nextStep(false);
        const selectedAfter = controller.getSelectedComponent();
        expect(selectedAfter?.nodeName).toBe('Housing');
        expect(selectedAfter?.id).toBe('101');
    });

    it('7. Existing continuous explosion slider functions and updates all components', () => {
        const controller = new StageController(mockScene, mockModel);

        controller.setContinuousFactor(0.5);

        // Both parts with radial offsets should have displaced proportionally
        expect(mockPart1.position.lengthSquared()).toBeGreaterThan(0);
        expect(mockPart2.position.lengthSquared()).toBeGreaterThan(0);

        controller.setContinuousFactor(0);
        expect(mockPart1.position.x).toBeCloseTo(0, 4);
        expect(mockPart2.position.x).toBeCloseTo(0, 4);
    });

    it('8. Multiple components can be separated with custom authored config', () => {
        const customConfig: ExplosionSequenceConfig = {
            machineId: 'slurry_pump_001',
            machineName: 'Centrifugal Slurry Pump',
            explosionSteps: [
                {
                    id: 'step_baseline',
                    stepNumber: 1,
                    title: 'Full Assembly',
                    description: 'Assembled pump',
                    componentIds: [],
                    explodeFactor: 0,
                },
                {
                    id: 'step_outer',
                    stepNumber: 2,
                    title: 'Housing Removal',
                    description: 'Remove casing',
                    componentIds: ['Housing'],
                    explodeFactor: 0.4,
                },
                {
                    id: 'step_dual',
                    stepNumber: 3,
                    title: 'Casing and Bracket Separation',
                    description: 'Separate both housing and bracket',
                    componentIds: ['Housing', 'Bracket'],
                    explodeFactor: 0.8,
                    componentOffsets: {
                        Housing: 0.9,
                        Bracket: 0.5,
                    },
                },
            ],
        };

        const controller = new StageController(mockScene, mockModel, customConfig);
        expect(controller.getTotalSteps()).toBe(3);

        controller.goToStep(2, false);
        expect(controller.getCurrentStep().title).toBe('Casing and Bracket Separation');
        expect(mockPart1.position.lengthSquared()).toBeGreaterThan(0);
        expect(mockPart2.position.lengthSquared()).toBeGreaterThan(0);
    });

    it('9. Empty or invalid stage configurations are handled gracefully by validation', () => {
        // Null payload
        const nullRes = validateExplosionConfig(null);
        expect(nullRes.valid).toBe(false);
        expect(nullRes.config.explosionSteps.length).toBeGreaterThanOrEqual(1);

        // Empty steps array
        const emptyRes = validateExplosionConfig({ machineId: 'm1', explosionSteps: [] });
        expect(emptyRes.valid).toBe(false);
        expect(emptyRes.config.explosionSteps.length).toBe(1);
        expect(emptyRes.config.explosionSteps[0]?.title).toBe('Complete Assembly');

        // Malformed steps with missing fields are sanitized
        const malformedRes = validateExplosionConfig({
            machineId: 'm2',
            explosionSteps: [
                { title: 'Step Without ID' },
                { id: 'custom_id', explodeFactor: 'invalid_factor', componentIds: [123, 'Bracket'] },
            ],
        });
        expect(malformedRes.valid).toBe(true);
        expect(malformedRes.config.explosionSteps.length).toBe(2);
        expect(malformedRes.config.explosionSteps[0]?.id).toBeDefined();
        expect(malformedRes.config.explosionSteps[1]?.explodeFactor).toBe(0);
        expect(malformedRes.config.explosionSteps[1]?.componentIds).toEqual(['Bracket']);
    });

    it('10. Auto-generator correctly flags inferred stages without manufacturer claim', () => {
        const autoConfig = generateAutoExplosionConfig(mockModel, 'test_machine');
        expect(autoConfig.isAutoInferred).toBe(true);
        expect(autoConfig.notes).toContain('Do not claim this represents the manufacturer');
        expect(autoConfig.explosionSteps.length).toBe(4);
        expect(autoConfig.explosionSteps[1]?.title).toContain('[Auto-Inferred]');
        expect(autoConfig.explosionSteps[2]?.title).toContain('[Auto-Inferred]');
        expect(autoConfig.explosionSteps[3]?.title).toContain('[Auto-Inferred]');
    });
});
