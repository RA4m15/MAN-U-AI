// Explosion stage configuration schemas, validation, and auto-generation.
// Supports both verified manufacturer disassembly sequences and auto-inferred
// geometric hierarchy stages.

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { BuiltModel } from '../builder';

export interface Vector3Offset {
    x: number;
    y: number;
    z: number;
}

export interface ExplosionStep {
    id: string;
    stepNumber: number;
    title: string;
    description: string;
    componentIds: string[];
    explodeFactor: number;
    componentVisibility?: Record<string, boolean>;
    componentOffsets?: Record<string, number | Vector3Offset>;
    highlightedComponentIds?: string[];
    cameraTarget?: { x: number; y: number; z: number; radius?: number };
    isActive?: boolean;
    isCompleted?: boolean;
    isInferred?: boolean;
}

export interface ExplosionSequenceConfig {
    machineId: string;
    machineName?: string;
    description?: string;
    version?: string;
    isAutoInferred?: boolean;
    notes?: string;
    explosionSteps: ExplosionStep[];
}

export interface ValidationResult {
    valid: boolean;
    config: ExplosionSequenceConfig;
    errors: string[];
    warnings: string[];
}

function isMeshLike(node: unknown): node is Mesh {
    return node instanceof Mesh || (typeof node === 'object' && node !== null && typeof (node as { setEnabled?: unknown }).setEnabled === 'function');
}

function isNodeLike(node: unknown): node is TransformNode {
    return node instanceof TransformNode || (typeof node === 'object' && node !== null && typeof (node as { getChildren?: unknown }).getChildren === 'function');
}

function collectMeshes(node: TransformNode, out: Mesh[]): void {
    if (isMeshLike(node) && !out.includes(node)) {
        out.push(node);
    }
    for (const child of node.getChildren()) {
        if (isMeshLike(child)) {
            if (!out.includes(child)) out.push(child);
        } else if (isNodeLike(child)) {
            collectMeshes(child, out);
        }
    }
}

function nodeCentroid(node: TransformNode): Vector3 | null {
    const meshes: Mesh[] = [];
    collectMeshes(node, meshes);
    if (meshes.length === 0) return null;
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const m of meshes) {
        if (!m.getBoundingInfo) continue;
        m.computeWorldMatrix(true);
        const info = m.getBoundingInfo();
        min = Vector3.Minimize(min, info.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, info.boundingBox.maximumWorld);
    }
    return isFinite(min.x) && isFinite(max.x) ? Vector3.Center(min, max) : null;
}

function modelCentroid(model: BuiltModel): Vector3 {
    if (model.meshes.length === 0) return Vector3.Zero();
    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const m of model.meshes) {
        if (!m.getBoundingInfo) continue;
        m.computeWorldMatrix(true);
        const info = m.getBoundingInfo();
        min = Vector3.Minimize(min, info.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, info.boundingBox.maximumWorld);
    }
    return isFinite(min.x) && isFinite(max.x) ? Vector3.Center(min, max) : Vector3.Zero();
}

/**
 * Creates a safe fallback configuration when input data is missing or empty.
 */
export function createDefaultFallbackConfig(machineId = 'default_machine', machineName = 'Assembly'): ExplosionSequenceConfig {
    return {
        machineId,
        machineName,
        description: 'Default baseline assembly state.',
        version: '1.0.0',
        isAutoInferred: true,
        notes: 'Fallback configuration created because no valid explosion steps were supplied.',
        explosionSteps: [
            {
                id: 'step_01',
                stepNumber: 1,
                title: 'Complete Assembly',
                description: 'Initial assembled state of the machine.',
                componentIds: [],
                explodeFactor: 0,
                isActive: true,
                isCompleted: false,
                isInferred: true,
            },
        ],
    };
}

/**
 * Validate and sanitize an incoming explosion sequence configuration.
 * Gracefully handles malformed or incomplete objects.
 */
export function validateExplosionConfig(raw: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!raw || typeof raw !== 'object') {
        errors.push('Configuration payload must be a non-null object.');
        return {
            valid: false,
            config: createDefaultFallbackConfig(),
            errors,
            warnings,
        };
    }

    const input = raw as Record<string, unknown>;
    const machineId = typeof input.machineId === 'string' && input.machineId.trim().length > 0
        ? input.machineId.trim()
        : 'machine_001';

    const machineName = typeof input.machineName === 'string'
        ? input.machineName.trim()
        : undefined;

    const description = typeof input.description === 'string'
        ? input.description.trim()
        : undefined;

    const isAutoInferred = Boolean(input.isAutoInferred);

    const rawSteps = input.explosionSteps;
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
        errors.push('Configuration property "explosionSteps" must be a non-empty array.');
        return {
            valid: false,
            config: createDefaultFallbackConfig(machineId, machineName),
            errors,
            warnings,
        };
    }

    const seenIds = new Set<string>();
    const sanitizedSteps: ExplosionStep[] = [];

    for (let i = 0; i < rawSteps.length; i++) {
        const stepRaw = rawSteps[i];
        if (!stepRaw || typeof stepRaw !== 'object') {
            warnings.push(`Step at index ${i} is not a valid object; skipping.`);
            continue;
        }

        const step = stepRaw as Record<string, unknown>;
        let id = typeof step.id === 'string' && step.id.trim().length > 0
            ? step.id.trim()
            : `step_${String(i + 1).padStart(2, '0')}`;

        if (seenIds.has(id)) {
            warnings.push(`Duplicate step ID "${id}" at index ${i}; generated unique ID.`);
            id = `${id}_${i + 1}`;
        }
        seenIds.add(id);

        const stepNumber = typeof step.stepNumber === 'number' && Number.isFinite(step.stepNumber)
            ? step.stepNumber
            : i + 1;

        const title = typeof step.title === 'string' && step.title.trim().length > 0
            ? step.title.trim()
            : `Stage ${stepNumber}`;

        const desc = typeof step.description === 'string'
            ? step.description.trim()
            : `Explosion stage ${stepNumber}`;

        let componentIds: string[] = [];
        if (Array.isArray(step.componentIds)) {
            componentIds = step.componentIds
                .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
                .map((c) => c.trim());
        }

        let explodeFactor = 0;
        if (typeof step.explodeFactor === 'number' && Number.isFinite(step.explodeFactor)) {
            explodeFactor = Math.max(0, Math.min(2.0, step.explodeFactor));
        }

        const sanitizedStep: ExplosionStep = {
            id,
            stepNumber,
            title,
            description: desc,
            componentIds,
            explodeFactor,
            isActive: Boolean(step.isActive) || i === 0,
            isCompleted: Boolean(step.isCompleted),
            isInferred: typeof step.isInferred === 'boolean' ? step.isInferred : isAutoInferred,
        };

        if (step.componentVisibility && typeof step.componentVisibility === 'object') {
            sanitizedStep.componentVisibility = step.componentVisibility as Record<string, boolean>;
        }

        if (step.componentOffsets && typeof step.componentOffsets === 'object') {
            sanitizedStep.componentOffsets = step.componentOffsets as Record<string, number | Vector3Offset>;
        }

        if (Array.isArray(step.highlightedComponentIds)) {
            sanitizedStep.highlightedComponentIds = step.highlightedComponentIds.filter(
                (c): c is string => typeof c === 'string' && c.trim().length > 0,
            );
        }

        sanitizedSteps.push(sanitizedStep);
    }

    if (sanitizedSteps.length === 0) {
        errors.push('No valid steps could be parsed from explosionSteps.');
        return {
            valid: false,
            config: createDefaultFallbackConfig(machineId, machineName),
            errors,
            warnings,
        };
    }

    // Ensure step numbers are sequential 1..N
    sanitizedSteps.forEach((s, idx) => {
        s.stepNumber = idx + 1;
    });

    const finalConfig: ExplosionSequenceConfig = {
        machineId,
        machineName,
        description,
        version: typeof input.version === 'string' ? input.version : '1.0.0',
        isAutoInferred,
        notes: typeof input.notes === 'string' ? input.notes : undefined,
        explosionSteps: sanitizedSteps,
    };

    return {
        valid: errors.length === 0,
        config: finalConfig,
        errors,
        warnings,
    };
}

/**
 * Generate an explosion sequence configuration automatically from the imported
 * assembly hierarchy. Clearly flags steps as auto-inferred geometric stages.
 */
export function generateAutoExplosionConfig(
    model: BuiltModel,
    machineId = 'imported_assembly',
    machineName = 'Imported Machine',
): ExplosionSequenceConfig {
    const parts = model.topLevel;

    if (parts.length === 0) {
        return createDefaultFallbackConfig(machineId, machineName);
    }

    if (parts.length === 1) {
        const partName = parts[0]?.name || 'SingleComponent';
        return {
            machineId,
            machineName,
            description: `Single component model: ${partName}`,
            version: '1.0.0',
            isAutoInferred: true,
            notes: 'Single part model; sequential disassembly is a no-op.',
            explosionSteps: [
                {
                    id: 'step_01',
                    stepNumber: 1,
                    title: 'Complete Assembly (Baseline)',
                    description: `Baseline view of ${partName}.`,
                    componentIds: [],
                    explodeFactor: 0,
                    isActive: true,
                    isCompleted: false,
                    isInferred: true,
                },
                {
                    id: 'step_02',
                    stepNumber: 2,
                    title: 'Component Inspection [Auto-Inferred]',
                    description: `${partName} isolated for detailed dimensional inspection.`,
                    componentIds: [partName],
                    explodeFactor: 0.2,
                    isActive: false,
                    isCompleted: false,
                    isInferred: true,
                },
            ],
        };
    }

    if (parts.length === 2) {
        const p1 = parts[0]?.name || 'Part_1';
        const p2 = parts[1]?.name || 'Part_2';
        return {
            machineId,
            machineName,
            description: `Two-part assembly (${p1}, ${p2})`,
            version: '1.0.0',
            isAutoInferred: true,
            notes: 'Generated from 2-component assembly hierarchy. Not manufacturer verified.',
            explosionSteps: [
                {
                    id: 'step_01',
                    stepNumber: 1,
                    title: 'Complete Assembly (Baseline)',
                    description: 'Fully assembled state of both components.',
                    componentIds: [],
                    explodeFactor: 0,
                    isActive: true,
                    isCompleted: false,
                    isInferred: true,
                },
                {
                    id: 'step_02',
                    stepNumber: 2,
                    title: 'Component Separation [Auto-Inferred]',
                    description: `Separation of ${p1} and ${p2} along geometric radial vectors. (Auto-inferred geometry, not manufacturer verified disassembly sequence).`,
                    componentIds: [p1, p2],
                    explodeFactor: 0.8,
                    isActive: false,
                    isCompleted: false,
                    isInferred: true,
                },
            ],
        };
    }

    // 3 or more parts: categorize based on distance from centroid
    const center = modelCentroid(model);
    interface PartDistance {
        name: string;
        distance: number;
    }

    const distList: PartDistance[] = parts.map((p) => {
        const c = nodeCentroid(p);
        const dist = c ? Vector3.Distance(center, c) : 0;
        return { name: p.name, distance: dist };
    });

    // Sort descending by distance: furthest/outer parts first
    distList.sort((a, b) => b.distance - a.distance);

    const count = distList.length;
    const outerCount = Math.max(1, Math.round(count * 0.35));
    const midCount = Math.max(outerCount + 1, Math.round(count * 0.70));

    const outerParts = distList.slice(0, outerCount).map((p) => p.name);
    const midParts = distList.slice(0, midCount).map((p) => p.name);
    const allParts = distList.map((p) => p.name);

    return {
        machineId,
        machineName,
        description: `Assembly comprising ${count} components.`,
        version: '1.0.0',
        isAutoInferred: true,
        notes: 'Stages calculated geometrically outward from shared centroid. Do not claim this represents the manufacturer verified disassembly procedure.',
        explosionSteps: [
            {
                id: 'step_01',
                stepNumber: 1,
                title: 'Complete Assembly (Baseline)',
                description: 'Fully assembled machine in baseline operating configuration.',
                componentIds: [],
                explodeFactor: 0,
                isActive: true,
                isCompleted: false,
                isInferred: true,
            },
            {
                id: 'step_02',
                stepNumber: 2,
                title: 'Outer Assembly Separation [Auto-Inferred]',
                description: `Outermost components (${outerParts.length} parts) displaced along radial axes. (Auto-inferred geometry, not manufacturer verified).`,
                componentIds: outerParts,
                explodeFactor: 0.35,
                isActive: false,
                isCompleted: false,
                isInferred: true,
            },
            {
                id: 'step_03',
                stepNumber: 3,
                title: 'Internal Assembly Exposure [Auto-Inferred]',
                description: `Intermediate structural parts (${midParts.length} parts) separated to expose inner mechanisms. (Auto-inferred geometry).`,
                componentIds: midParts,
                explodeFactor: 0.70,
                isActive: false,
                isCompleted: false,
                isInferred: true,
            },
            {
                id: 'step_04',
                stepNumber: 4,
                title: 'Complete Disassembly [Auto-Inferred]',
                description: `All ${allParts.length} components separated outward to their full explosion perimeter. (Auto-inferred geometry).`,
                componentIds: allParts,
                explodeFactor: 1.0,
                isActive: false,
                isCompleted: false,
                isInferred: true,
            },
        ],
    };
}