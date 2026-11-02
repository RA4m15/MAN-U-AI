import mongoose from "mongoose";
import { Equipment, IEquipment } from "../models";
import { isConnectedToMongo } from "../config/database";
import type { ComponentMetadataDTO } from "@man-u-ai/shared";

export interface ResolvedMachine {
  id: string;
  name: string;
  category?: string;
  model?: string;
  manufacturer?: string;
  referenceImage?: string | null;
  cadModel?: {
    available: boolean;
    format?: string | null;
    storageReference?: string | null;
    version?: string | null;
    fileSizeBytes?: number | null;
    uploadedAt?: string | null;
  };
  documentIds: string[];
  components: ComponentMetadataDTO[];
  explosionConfiguration?: Record<string, any> | null;
}

/**
 * Built-in verified industrial machine manifests for standard equipment.
 * Used for dynamic CAD assembly mapping and offline/hybrid fallback.
 */
export interface MachineManifestEntry {
  name: string;
  category?: string;
  model?: string;
  manufacturer?: string;
  referenceImage?: string;
  cadModel?: {
    available: boolean;
    format: string | null;
    storageReference: string | null;
    version: string | null;
    fileSizeBytes?: number | null;
    uploadedAt?: string | null;
  };
  documentIds?: string[];
  components: ComponentMetadataDTO[];
  explosionConfiguration?: Record<string, any> | null;
}

const DEFAULT_VERIFIED_MANIFESTS: Record<string, MachineManifestEntry> = {
  // MACHINE 01: Industrial Turbomachinery Assembly
  machine_001: {
    name: "Industrial Slurry Pump P-102",
    model: "SP-400 Heavy Duty",
    category: "Industrial rotating equipment",
    cadModel: {
      available: true,
      format: "STEP",
      storageReference: "/cad/models/slurry_pump_p102.step",
      version: "1.0",
    },
    documentIds: ["doc-01", "doc-slurry-pump"],
    components: [
      {
        partId: "bearing_assembly_01",
        name: "Bearing Assembly",
        description: "Heavy-duty double row spherical roller bearing supporting rotor shaft.",
        parentAssemblyId: "rotor_assembly",
        aliases: ["shaft bearing", "motor bearing", "roller bearing", "pump bearing"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
        technicalSpecifications: {
          bearingType: "Spherical Roller 22216",
          maxTempC: 85,
          lubrication: "ISO VG 220 Synthetic Gear/Bearing Oil",
          vibrationLimitRms: 2.8,
        },
        maintenanceInstructions: [
          "Check operating temperature with infrared thermometer. Overheating (>80°C) indicates lubrication starvation or misalignment.",
          "Inspect radial clearance every 2,000 operating hours. Max allowable wear clearance: 0.12 mm.",
        ],
      },
      {
        partId: "mechanical_seal_02",
        name: "Mechanical Seal Cartridge",
        description: "Dual cartridge mechanical seal preventing fluid leakage across housing.",
        parentAssemblyId: "casing_assembly",
        aliases: ["seal", "shaft seal", "mechanical seal", "cartridge seal"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
        technicalSpecifications: {
          sealFaces: "Silicon Carbide vs Tungsten Carbide",
          flushPressureBar: 4.5,
          torqueNm: 45,
        },
        maintenanceInstructions: [
          "Tighten four M12 gland retaining nuts in cross-diagonal sequence to 45 N·m.",
          "Verify barrier fluid pressure is maintained at 1.5 bar above stuffing box pressure.",
        ],
      },
      {
        partId: "impeller_01",
        name: "Slurry Impeller",
        description: "Closed multi-vane high-chrome abrasive slurry impeller.",
        parentAssemblyId: "rotor_assembly",
        aliases: ["impeller", "slurry impeller", "runner"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
      },
      {
        partId: "suction_casing_01",
        name: "Suction Casing Liner",
        description: "Cast high-chrome alloy wear liner protecting outer casing from abrasion.",
        parentAssemblyId: "casing_assembly",
        aliases: ["casing", "liner", "casing liner"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
      },
    ],
  },

  // MACHINE 01: Industrial Turbomachinery Assembly
  machine_turbomachinery: {
    name: "Industrial Turbomachinery Assembly",
    category: "Industrial rotating equipment",
    referenceImage: "assets/images/machines/machine_turbomachinery.jpg",
    cadModel: {
      available: false,
      format: null,
      storageReference: null,
      version: null,
    },
    documentIds: ["doc-turbomachinery-01"],
    components: [],
    explosionConfiguration: null,
  },

  // MACHINE 02: CAT Generator Set
  machine_002: {
    name: "CAT Generator Set",
    category: "Power generation equipment",
    referenceImage: "assets/images/machines/machine_cat_generator.jpg",
    cadModel: {
      available: false,
      format: null,
      storageReference: null,
      version: null,
    },
    documentIds: [],
    components: [],
    explosionConfiguration: null,
  },

  // MACHINE 03: Industrial Process Equipment Skid
  machine_003: {
    name: "Industrial Process Equipment Skid",
    category: "Industrial process equipment",
    referenceImage: "assets/images/machines/machine_process_skid.jpg",
    cadModel: {
      available: false,
      format: null,
      storageReference: null,
      version: null,
    },
    documentIds: [],
    components: [],
    explosionConfiguration: null,
  },

  // MACHINE 04: CNC Machining Center
  machine_004: {
    name: "CNC Machining Center",
    category: "Manufacturing equipment",
    referenceImage: "assets/images/machines/machine_cnc_center.jpg",
    cadModel: {
      available: false,
      format: null,
      storageReference: null,
      version: null,
    },
    documentIds: [],
    components: [],
    explosionConfiguration: null,
  },

  // Legacy Centrifugal Slurry Pump alias
  slurry_pump_legacy: {
    name: "Industrial Slurry Pump P-102",
    model: "SP-400 Heavy Duty",
    documentIds: ["doc-01", "doc-slurry-pump"],
    components: [
      {
        partId: "bearing_assembly_01",
        name: "Bearing Assembly",
        description: "Heavy-duty double row spherical roller bearing supporting pump impeller shaft.",
        parentAssemblyId: "rotor_assembly",
        aliases: ["shaft bearing", "motor bearing", "roller bearing", "pump bearing"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
        technicalSpecifications: {
          bearingType: "Spherical Roller 22216",
          maxTempC: 85,
          lubrication: "ISO VG 220 Synthetic Gear/Bearing Oil",
          vibrationLimitRms: 2.8,
        },
        maintenanceInstructions: [
          "Check operating temperature with infrared thermometer. Overheating (>80°C) indicates lubrication starvation or misalignment.",
          "Inspect radial clearance every 2,000 operating hours. Max allowable wear clearance: 0.12 mm.",
        ],
      },
      {
        partId: "mechanical_seal_02",
        name: "Mechanical Seal Cartridge",
        description: "Dual cartridge mechanical seal preventing slurry leakage across pump housing.",
        parentAssemblyId: "casing_assembly",
        aliases: ["seal", "shaft seal", "mechanical seal", "cartridge seal"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
        technicalSpecifications: {
          sealFaces: "Silicon Carbide vs Tungsten Carbide",
          flushPressureBar: 4.5,
          torqueNm: 45,
        },
        maintenanceInstructions: [
          "Tighten four M12 gland retaining nuts in cross-diagonal sequence to 45 N·m.",
          "Verify barrier fluid pressure is maintained at 1.5 bar above stuffing box pressure.",
        ],
      },
      {
        partId: "impeller_01",
        name: "High-Chrome Slurry Impeller",
        description: "Closed 4-vane high-chrome abrasive slurry impeller.",
        parentAssemblyId: "rotor_assembly",
        aliases: ["impeller", "slurry impeller", "pump runner"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
        technicalSpecifications: {
          material: "27% High-Chrome White Iron (ASTM A532)",
          diameterMm: 380,
        },
      },
      {
        partId: "suction_casing_01",
        name: "Suction Casing Volute",
        description: "Abrasion-resistant split volute pump casing with inspection port.",
        parentAssemblyId: "casing_assembly",
        aliases: ["casing", "volute", "pump housing"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
      },
    ],
  },

  slurry_pump_9: {
    name: "Industrial Slurry Pump P-102",
    model: "SP-400 Heavy Duty",
    documentIds: ["doc-01", "doc-slurry-pump"],
    components: [
      {
        partId: "ceramic_seal_04",
        name: "Ceramic Mechanical Seal",
        description: "Precision ceramic-faced mechanical seal assembly.",
        parentAssemblyId: "shaft_housing",
        aliases: ["mechanical seal", "ceramic seal", "seal 04"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
        technicalSpecifications: {
          faceMaterial: "Alumina Ceramic / Carbon",
          maxPressureBar: 16.0,
        },
      },
      {
        partId: "bearing_assembly_01",
        name: "Bearing Assembly",
        description: "Heavy-duty spherical roller bearing assembly.",
        parentAssemblyId: "rotor_assembly",
        aliases: ["shaft bearing", "motor bearing", "roller bearing"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
      },
    ],
  },

  // SimReady Conveyor Belt A61
  "equip-cb-a61": {
    name: "Conveyor Belt A61",
    model: "A61-SIMREADY-01",
    category: "Modular Belt Conveyor",
    cadModel: {
      available: true,
      format: "STEP",
      storageReference: "/cad/models/conveyor_belt_a61.step",
      version: "1.0",
    },
    documentIds: ["doc-cb-a61", "doc-conveyor-a61"],
    components: [
      {
        partId: "CB-A61-01",
        name: "Drive Motor Assembly",
        description: "480V 3-phase high-torque drive motor powering conveyor head pulley.",
        parentAssemblyId: "drive_station",
        aliases: ["drive motor", "motor", "conveyor motor", "head drive"],
        documentReferences: ["doc-cb-a61", "doc-conveyor-a61"],
        technicalSpecifications: {
          voltage: "480V 3-Phase",
          powerKw: 15.0,
          beltSpeedMs: 1.5,
        },
      },
      {
        partId: "CB-A61-02",
        name: "Idler Roller Precision Bearing",
        description: "Brushed aluminum precision idler roller with ABEC-5 double sealed bearings.",
        parentAssemblyId: "roller_bed",
        aliases: ["roller", "idler roller", "roller bearing", "sm_roller01"],
        documentReferences: ["doc-cb-a61", "doc-conveyor-a61"],
        technicalSpecifications: {
          bearingRating: "ABEC-5 Double Sealed",
          torqueRetentionNm: 32,
          nominalTensionKnM: 16.5,
        },
        maintenanceInstructions: [
          "De-energize primary breaker MCC-CB-01 and verify zero kinetic energy before roller removal.",
          "Torque axle retention bolts to 32 N·m.",
        ],
      },
      {
        partId: "CB-A61-04",
        name: "Optical Inspection Scanning Sensor Module",
        description: "High-speed line scanner inspecting item positioning on belt.",
        parentAssemblyId: "scanner_gantry",
        aliases: ["sensor", "scanner", "optical sensor", "inspection scanner"],
        documentReferences: ["doc-cb-a61", "doc-conveyor-a61"],
      },
    ],
  },

  // Centrifugal Pump P-102
  "equip-p102": {
    name: "Centrifugal Slurry Pump P-102",
    model: "SP-400 Heavy Duty",
    category: "Centrifugal Pump",
    cadModel: {
      available: true,
      format: "STEP",
      storageReference: "/cad/models/slurry_pump_p102.step",
      version: "1.0",
    },
    documentIds: ["doc-01", "doc-slurry-pump"],
    components: [
      {
        partId: "bearing_assembly_01",
        name: "Bearing Assembly",
        description: "Heavy-duty spherical roller bearing assembly.",
        parentAssemblyId: "rotor_assembly",
        aliases: ["shaft bearing", "motor bearing", "roller bearing"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
      },
      {
        partId: "mechanical_seal_02",
        name: "Mechanical Seal Cartridge",
        description: "Dual cartridge mechanical seal preventing slurry leakage.",
        parentAssemblyId: "casing_assembly",
        aliases: ["seal", "shaft seal", "mechanical seal"],
        documentReferences: ["doc-01", "doc-slurry-pump"],
      },
    ],
  },
};

export class MachineComponentService {
  private dynamicManifests = new Map<string, MachineManifestEntry>();

  constructor() {
    // Populate default manifests
    for (const [key, val] of Object.entries(DEFAULT_VERIFIED_MANIFESTS)) {
      this.dynamicManifests.set(key.toLowerCase(), val);
    }
  }

  /**
   * Registers or updates a machine component manifest at runtime.
   */
  public registerMachineManifest(
    machineId: string,
    manifest: MachineManifestEntry
  ): void {
    if (!machineId) return;
    this.dynamicManifests.set(machineId.toLowerCase().trim(), manifest);
  }

  /**
   * Authoritatively resolves machine metadata, document IDs, and components.
   * Checks persistent MongoDB database first, falling back to dynamic/verified manifests.
   */
  public async resolveMachine(machineId: string): Promise<ResolvedMachine | null> {
    if (!machineId || typeof machineId !== "string") return null;
    const cleanId = machineId.trim();

    // 1. Check MongoDB Equipment if connected
    if (isConnectedToMongo) {
      try {
        let eq: any = null;
        if (mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24) {
          eq = await Equipment.findById(cleanId);
        }
        if (!eq) {
          eq = await Equipment.findOne({
            $or: [
              { model: new RegExp(`^${cleanId}$`, "i") },
              { serialNumber: cleanId },
              { name: new RegExp(`^${cleanId}$`, "i") },
            ],
          });
        }

        if (eq) {
          const docIds = (eq.documentIds || []).map((d: any) => d.toString());
          const manifestMatch = this.dynamicManifests.get(cleanId.toLowerCase()) ||
            this.dynamicManifests.get(eq.model?.toLowerCase() ?? "") ||
            this.dynamicManifests.get("machine_001");

          const dbComponents: ComponentMetadataDTO[] = (eq as any).components || [];
          const mergedComponents = [
            ...dbComponents,
            ...(manifestMatch?.components || []).filter(
              (mc) => !dbComponents.some((dc) => dc.partId.toLowerCase() === mc.partId.toLowerCase())
            ),
          ];

          return {
            id: eq._id.toString(),
            name: eq.name,
            category: eq.category || eq.type || manifestMatch?.category,
            model: eq.model || manifestMatch?.model,
            manufacturer: eq.manufacturer || manifestMatch?.manufacturer,
            referenceImage: eq.referenceImage || manifestMatch?.referenceImage,
            cadModel: eq.cadModel || manifestMatch?.cadModel || { available: false },
            documentIds: Array.from(new Set([...docIds, ...(manifestMatch?.documentIds || [])])),
            components: mergedComponents,
            explosionConfiguration: eq.explosionConfiguration || manifestMatch?.explosionConfiguration,
          };
        }
      } catch (err) {
        console.warn(`[MachineComponentService] Error querying Equipment for ${cleanId}:`, err);
      }
    }

    // 2. Fallback to in-memory verified dynamic manifests
    const manifest = this.dynamicManifests.get(cleanId.toLowerCase());
    if (manifest) {
      return {
        id: cleanId,
        name: manifest.name,
        category: manifest.category,
        model: manifest.model,
        manufacturer: manifest.manufacturer,
        referenceImage: manifest.referenceImage,
        cadModel: manifest.cadModel || { available: false },
        documentIds: manifest.documentIds || [],
        components: manifest.components,
        explosionConfiguration: manifest.explosionConfiguration,
      };
    }

    return null;
  }

  /**
   * Resolves a component from authoritative machine metadata.
   * Does NOT blindly trust client-provided names or descriptions.
   */
  public async resolveComponent(machineId: string, partId: string): Promise<ComponentMetadataDTO | null> {
    if (!machineId || !partId) return null;
    const machine = await this.resolveMachine(machineId);
    if (!machine) return null;

    const cleanPart = partId.toLowerCase().trim();
    for (const comp of machine.components) {
      if (comp.partId.toLowerCase() === cleanPart) {
        return comp;
      }
      if (comp.name.toLowerCase() === cleanPart) {
        return comp;
      }
      if (comp.aliases && comp.aliases.some((a) => a.toLowerCase() === cleanPart)) {
        return comp;
      }
    }

    return null;
  }

  /**
   * Validates component ownership against the specified machine.
   * Ensures component belongs to the machine and is not an arbitrary/injected ID.
   */
  public async validateComponentOwnership(
    machineId: string,
    partId?: string
  ): Promise<{ valid: boolean; error?: string; component?: ComponentMetadataDTO; machine?: ResolvedMachine }> {
    if (!machineId) {
      return { valid: false, error: "Machine ID is required" };
    }
    const machine = await this.resolveMachine(machineId);
    if (!machine) {
      return { valid: false, error: `Referenced machine '${machineId}' does not exist` };
    }

    if (!partId || !partId.trim()) {
      return { valid: true, machine };
    }

    const component = await this.resolveComponent(machineId, partId);
    if (!component) {
      return {
        valid: false,
        error: `Component '${partId}' does not belong to machine '${machine.name}' (${machineId})`,
        machine,
      };
    }

    return { valid: true, component, machine };
  }
}

export const machineComponentService = new MachineComponentService();
