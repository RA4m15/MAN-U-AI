// Sequential Explosion Stage Controller: manages step navigation,
// component transformations, animations, visibility, and selection preservation.

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';

import type { BuiltModel } from '../builder';
import {
    type ExplosionSequenceConfig,
    type ExplosionStep,
    type Vector3Offset,
    validateExplosionConfig,
    generateAutoExplosionConfig,
} from './stage-config';

export interface ComponentEntry {
    node: TransformNode;
    name: string;
    home: Vector3;
    offset: Vector3;
    currentPosition: Vector3;
    targetPosition: Vector3;
    startPosition: Vector3;
    meshes: Mesh[];
}

export interface SelectedComponentData {
    nodeName: string;
    id: string;
    meshName: string;
    faceIndex?: number;
    description?: string;
}

export type StepChangedListener = (step: ExplosionStep, index: number, total: number) => void;
export type ComponentSelectedListener = (component: SelectedComponentData | null) => void;

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

function modelRadius(model: BuiltModel, center: Vector3): number {
    let max = 0;
    for (const m of model.meshes) {
        if (!m.getBoundingInfo) continue;
        const info = m.getBoundingInfo();
        const d = Vector3.Distance(center, info.boundingBox.centerWorld);
        if (d > max) max = d;
    }
    return max || 1;
}

function matchComponent(nodeName: string, queryId: string): boolean {
    const a = nodeName.trim().toLowerCase();
    const b = queryId.trim().toLowerCase();
    if (a === b) return true;
    const cleanA = a.replace(/[^a-z0-9]/g, '');
    const cleanB = b.replace(/[^a-z0-9]/g, '');
    if (cleanA && cleanB && (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA))) {
        return true;
    }
    return false;
}

export class StageController {
    private scene: Scene;
    private model: BuiltModel;
    private entries: ComponentEntry[] = [];
    private config: ExplosionSequenceConfig;
    private currentIndex = 0;
    private selectedComponent: SelectedComponentData | null = null;

    private stepChangedListeners: StepChangedListener[] = [];
    private componentSelectedListeners: ComponentSelectedListener[] = [];

    // Animation state
    private animationObserver: Observer<Scene> | null = null;
    private isAnimating = false;
    private animationStartTime = 0;
    private animationDuration = 350; // ms

    constructor(scene: Scene, model: BuiltModel, initialConfig?: ExplosionSequenceConfig) {
        this.scene = scene;
        this.model = model;

        this.initEntries();

        if (initialConfig) {
            const validation = validateExplosionConfig(initialConfig);
            this.config = validation.config;
        } else {
            this.config = generateAutoExplosionConfig(model);
        }

        // Apply initial step (Step 1 baseline, instant without animation)
        this.applyStep(this.currentIndex, false);
    }

    private initEntries(): void {
        const center = modelCentroid(this.model);
        const radius = modelRadius(this.model, center);
        const explodeScale = radius * 1.25;

        this.entries = [];

        for (const child of this.model.topLevel) {
            const childCenter = nodeCentroid(child);
            const meshes: Mesh[] = [];
            collectMeshes(child, meshes);

            let offset = Vector3.Zero();
            if (childCenter) {
                const dir = childCenter.subtract(center);
                if (dir.lengthSquared() >= 1e-9) {
                    offset = dir.normalize().scale(explodeScale);
                } else {
                    // Fallback radial vector if centroid aligns with assembly center
                    offset = new Vector3(0, explodeScale * 0.5, 0);
                }
            }

            const homePos = child.position.clone();
            this.entries.push({
                node: child,
                name: child.name,
                home: homePos,
                offset,
                currentPosition: homePos.clone(),
                targetPosition: homePos.clone(),
                startPosition: homePos.clone(),
                meshes,
            });
        }
    }

    public getConfig(): ExplosionSequenceConfig {
        return this.config;
    }

    public setConfig(config: unknown): boolean {
        const validation = validateExplosionConfig(config);
        this.config = validation.config;
        this.currentIndex = 0;
        this.applyStep(0, false);
        this.notifyStepChanged();
        return validation.valid;
    }

    public getCurrentStepIndex(): number {
        return this.currentIndex;
    }

    public get animating(): boolean {
        return this.isAnimating;
    }

    public getCurrentStep(): ExplosionStep {
        return this.config.explosionSteps[this.currentIndex] ?? this.config.explosionSteps[0]!;
    }

    public getTotalSteps(): number {
        return this.config.explosionSteps.length;
    }

    public nextStep(animate = true): boolean {
        if (this.currentIndex < this.config.explosionSteps.length - 1) {
            this.goToStep(this.currentIndex + 1, animate);
            return true;
        }
        return false;
    }

    public previousStep(animate = true): boolean {
        if (this.currentIndex > 0) {
            this.goToStep(this.currentIndex - 1, animate);
            return true;
        }
        return false;
    }

    public goToStep(stepIndex: number, animate = true): boolean {
        if (stepIndex < 0 || stepIndex >= this.config.explosionSteps.length) {
            return false;
        }
        this.currentIndex = stepIndex;
        this.applyStep(this.currentIndex, animate);
        this.notifyStepChanged();
        return true;
    }

    public reset(animate = true): void {
        this.goToStep(0, animate);
    }

    /**
     * Compute target positions and visibility for a given step index and transition.
     */
    private applyStep(stepIndex: number, animate: boolean): void {
        const step = this.config.explosionSteps[stepIndex];
        if (!step) return;

        // Update active flag on steps
        this.config.explosionSteps.forEach((s, idx) => {
            s.isActive = idx === stepIndex;
            s.isCompleted = idx < stepIndex;
        });

        const isCompleteAssembly = step.explodeFactor === 0 || step.componentIds.length === 0;

        for (const entry of this.entries) {
            // 1. Position calculation
            let target = entry.home.clone();

            if (!isCompleteAssembly) {
                const isAffected = step.componentIds.some((id) => matchComponent(entry.name, id));

                if (isAffected) {
                    if (step.componentOffsets && step.componentOffsets[entry.name]) {
                        const customOffset = step.componentOffsets[entry.name];
                        if (typeof customOffset === 'number') {
                            target = entry.home.add(entry.offset.scale(customOffset));
                        } else if (customOffset && typeof customOffset === 'object') {
                            const vec = customOffset as Vector3Offset;
                            target = entry.home.add(new Vector3(vec.x, vec.y, vec.z));
                        }
                    } else {
                        target = entry.home.add(entry.offset.scale(step.explodeFactor));
                    }
                }
            }

            entry.startPosition = entry.node.position.clone();
            entry.targetPosition = target;

            // 2. Component visibility
            if (step.componentVisibility) {
                for (const [visId, visible] of Object.entries(step.componentVisibility)) {
                    if (matchComponent(entry.name, visId)) {
                        for (const m of entry.meshes) {
                            m.setEnabled(visible);
                        }
                    }
                }
            } else {
                // Default: ensure all meshes are visible
                for (const m of entry.meshes) {
                    m.setEnabled(true);
                }
            }
        }

        if (animate && this.scene) {
            this.startTransition();
        } else {
            // Instant positioning
            for (const entry of this.entries) {
                entry.node.position.copyFrom(entry.targetPosition);
                entry.currentPosition.copyFrom(entry.targetPosition);
            }
        }
    }

    /**
     * Smoothly animate entries from startPosition to targetPosition.
     */
    private startTransition(): void {
        this.stopTransition();
        this.isAnimating = true;
        this.animationStartTime = performance.now();

        this.animationObserver = this.scene.onBeforeRenderObservable.add(() => {
            const now = performance.now();
            const elapsed = now - this.animationStartTime;
            let progress = Math.min(1.0, elapsed / this.animationDuration);

            // Cubic easeInOut easing
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            for (const entry of this.entries) {
                const current = Vector3.Lerp(entry.startPosition, entry.targetPosition, ease);
                entry.node.position.copyFrom(current);
                entry.currentPosition.copyFrom(current);
            }

            if (progress >= 1.0) {
                this.stopTransition();
            }
        });
    }

    private stopTransition(): void {
        if (this.animationObserver) {
            this.scene.onBeforeRenderObservable.remove(this.animationObserver);
            this.animationObserver = null;
        }
        this.isAnimating = false;
    }

    /**
     * Continuous explosion factor slider support: translates all entries proportionally.
     */
    public setContinuousFactor(factor: number): void {
        this.stopTransition();
        const clamped = Math.max(0, Math.min(1.0, factor));
        for (const entry of this.entries) {
            const target = entry.home.add(entry.offset.scale(clamped));
            entry.node.position.copyFrom(target);
            entry.currentPosition.copyFrom(target);
        }
    }

    /**
     * Get or set selected component metadata.
     */
    public setSelectedComponent(data: SelectedComponentData | null): void {
        this.selectedComponent = data;
        for (const listener of this.componentSelectedListeners) {
            listener(data);
        }
    }

    public getSelectedComponent(): SelectedComponentData | null {
        return this.selectedComponent;
    }

    public onStepChanged(listener: StepChangedListener): () => void {
        this.stepChangedListeners.push(listener);
        return () => {
            this.stepChangedListeners = this.stepChangedListeners.filter((l) => l !== listener);
        };
    }

    public onComponentSelected(listener: ComponentSelectedListener): () => void {
        this.componentSelectedListeners.push(listener);
        return () => {
            this.componentSelectedListeners = this.componentSelectedListeners.filter((l) => l !== listener);
        };
    }

    private notifyStepChanged(): void {
        const step = this.getCurrentStep();
        const idx = this.currentIndex;
        const total = this.getTotalSteps();
        for (const listener of this.stepChangedListeners) {
            listener(step, idx, total);
        }
    }

    public dispose(): void {
        this.stopTransition();
        this.stepChangedListeners = [];
        this.componentSelectedListeners = [];
    }
}
