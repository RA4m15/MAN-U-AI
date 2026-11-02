import crypto from "crypto";
import mongoose from "mongoose";
import { Equipment, DocumentModel, DocumentChunk, DocumentFigure } from "../models";
import { isConnectedToMongo } from "../config/database";
import type {
  AreaPackDTO,
  AreaPackChunkDTO,
  DocumentDTO,
  DocumentFigureDTO,
  SyncCheckInput,
  SyncCheckResponseDTO,
} from "@man-u-ai/shared";

export class OfflineService {
  /**
   * Generates a complete Area Pack containing documents, chunks, and figures for an equipment unit.
   */
  async getAreaPack(equipmentId: string): Promise<AreaPackDTO | null> {
    if (equipmentId === "equip-drypix-6000" || equipmentId.toLowerCase().includes("drypix") || equipmentId.includes("6000")) {
      return {
        equipmentId: "equip-drypix-6000",
        equipmentName: "Fuji Medical Dry Laser Imager DRYPIX Smart",
        equipmentType: "Dry Laser Imager",
        model: "DRYPIX Smart (DRYPIX 6000)",
        generatedAt: new Date().toISOString(),
        versionHash: "drypix-6000-v8-hash-897n",
        documents: [
          {
            id: "doc-drypix-6000",
            title: "Fuji Medical Dry Laser Imager DRYPIX Smart (DRYPIX 6000) Reference Guide",
            revision: "8th Edition (897N102437G)",
            filename: "drypix_smart_reference_guide.pdf",
            mimeType: "application/pdf",
            sizeBytes: 6753751,
            status: "indexed",
            uploadedById: "mock-user-admin",
            ownerName: "Senior Biomedical Engineer",
            ownerEmail: "biomedical@manuai.internal",
            reviewDate: new Date(Date.now() + 3600000 * 24 * 365).toISOString(),
            isOverdue: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        chunks: [
          {
            id: "chk-dp-01",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            page: 58,
            section: "5.4 Error Code List & 5.5.1 Clearing Sheet-Feeder Film Jam (Err 221/223)",
            text: "When error code 221 or 223 is displayed on the operation panel, the film has become jammed in the sheet-feeder unit (Slot 1 or Slot 2). Step 1: Open the front cover by pulling outward. Step 2: Open the right-side cover. Step 3: Open the conveyance unit cover located inside of the right-side cover. Step 4: Carefully remove the jammed film without tearing. Step 5: Close conveyance unit cover, then right-side cover. Step 6: Open the bottom right-side cover, check and remove any jammed sheet. Step 7: Close bottom right-side cover, then front cover. The equipment will automatically re-initialize in 3 to 5 minutes.",
            safetyCategory: "general_procedure",
            ppeTags: ["antistatic_gloves", "safety_glasses"],
          },
          {
            id: "chk-dp-02",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            page: 65,
            section: "5.5.3 Clearing Film Jam in Recording Unit (Error 228)",
            text: "When error code 228 appears on the display panel, film has jammed inside the Laser Recording Unit. Procedure: (1) Confirm error 228 on display panel. (2) Open front cover by pulling outward by the green grip. (3) Slowly turn the right-side green handle clockwise to feed and advance the jammed film. Note: If the handle is turned when power is OFF, the pilot lamp may momentarily illuminate due to motor back-EMF; this is normal and not a defect. (4) Remove the discharged film sheet. (5) Close the front cover firmly. Equipment will be ready for printing in 3 to 5 minutes.",
            safetyCategory: "hazard_warning",
            ppeTags: ["safety_glasses", "cleanroom_gloves"],
          },
          {
            id: "chk-dp-03",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            page: 66,
            section: "5.5.4 Clearing Film Jam in Thermal Development Unit (Error 230)",
            text: "Error code 230 indicates film is jammed in the Thermal Development Unit. CAUTION: HIGH TEMPERATURE HAZARD. The heat processing drum reaches elevated temperatures; do not touch development drum surfaces. Procedure: (1) Open front cover. (2) Slowly turn the right-side handle clockwise and left-side handle counterclockwise one by one until the film end emerges. If film is hidden, turn left-side handle clockwise to eject through discharge unit. (3) Remove film. (4) Close front cover firmly. Machine resumes in 3 to 5 minutes.",
            safetyCategory: "hazard_warning",
            ppeTags: ["thermal_gloves", "safety_glasses"],
          },
          {
            id: "chk-dp-04",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            page: 35,
            section: "3.2 Replacing the Film Pack (DI-HL / DI-ML Film)",
            text: "When film tray counter reaches 0, 'EP1' (Film Tray 1) or 'EP2' (Film Tray 2) appears on display. Prepare Fuji Medical Dry Laser Image Film DI-HL or DI-ML. Procedure: (1) Press Enter button to unlock tray; display confirms 'oPn'. (2) Pull out film tray carefully, discard protective sheet and cardboard. (3) Place new film pack with arrow pointing to back of tray. (4) Raise pack end to tear label, open both ends. (5) Use film cutter stored on right side of operation panel to cut film pack along tray edge; replace cutter in slot. (6) Slowly push tray until it firmly locks ('PUL'). (7) Gently pull outer plastic pack wrapper straight out toward you.",
            safetyCategory: "general_procedure",
            ppeTags: ["cleanroom_gloves"],
          },
          {
            id: "chk-dp-05",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            page: 38,
            section: "3.3 Replacing Film Trays with Light-Tight Shutter",
            text: "Supported tray sizes: 35x43 cm (14x17\"), 35x35 cm (14x14\"), 26x36 cm (10x14\"), 25x30 cm (10x12\"), and 20x25 cm (8x10\"). When removing a tray loaded with film, the metal light-tight shutter (stored on rear of unit) must be inserted completely into the top slit of the tray. Once inserted, press Enter button until 'oPn' appears. Pull tray out using both hands (maximum weight ~8 kg). Slide new tray in firmly until 'PUL' appears, then withdraw shutter and return it to rear storage slot.",
            safetyCategory: "general_procedure",
            ppeTags: ["safety_shoes"],
          },
          {
            id: "chk-dp-06",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            page: 44,
            section: "4.4 Utility U-1: Automatic Film Density Calibration & QC Test Patterns",
            text: "Utility Menu: Press Utility button to cycle: U-1 (Auto film density calibration - prints step wedge on 14x17\" or 26x36cm and calibrates optical density gradation curve via built-in densitometer); U-2 (Output QC test pattern); U-3 (Reset remaining film counter to 0); U-4 (Sensitive material correction parameters); U-5 (Date and time clock setting); U-6 (SMPTE 1-5 test pattern); U-7 (Mammography QC pattern TG18-QC/PQC). Press Enter to select slot and execute.",
            safetyCategory: "general_procedure",
            ppeTags: [],
          },
          {
            id: "chk-dp-07",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            page: 13,
            section: "1.2 Laser Safety & Error Code 213/214 Notification",
            text: "This equipment contains an embedded Class 3B Semiconductor Laser operating at 659 nm (TYP) wavelength with 130 mW CW maximum output (IEC 60825-1 Class 1 Laser Product). Never remove covers other than front and right-side doors. Never defeat interlocks. When the end of laser diode operating life approaches, error code '213' appears (approximately 1 month operating life remaining). When error code '214' appears, laser life has expired and dealer replacement is mandatory.",
            safetyCategory: "hazard_warning",
            ppeTags: ["safety_glasses"],
          },
          {
            id: "chk-dp-08",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            page: 72,
            section: "6.1.3 Weekly Care: Washing Conveyance Cleaning Roller with Water",
            text: "When white blurred streaks or lint spots appear on printed film, wash the optional silicone cleaning roller with water once every week. Procedure: (1) Ensure no printing is in progress, then shut down system. (2) Open front cover and right-side cover. (3) Open conveyance unit cover and lift out cleaning roller with both hands. (4) Wash roller surface under splashing running tap water, rubbing gently. (5) Wipe off water using gauze moistened with alcohol (anhydrous ethanol). (6) Allow roller to dry completely before re-installing. Replace cleaning roller every 3 years.",
            safetyCategory: "general_procedure",
            ppeTags: ["lint_free_gloves", "safety_glasses"],
          },
        ],
        figures: [
          {
            id: "fig-drypix-units",
            documentId: "doc-drypix-6000",
            documentTitle: "Fuji Medical Dry Laser Imager DRYPIX Smart Reference Guide",
            revision: "8th Edition (897N102437G)",
            page: 30,
            figureId: "FIG-DRYPIX-6000",
            title: "DRYPIX Smart Main Unit Names and Functions",
            caption: "Isometric diagram illustrating Operation Panel, Front Cover, Film Trays 1 & 2, Laser Recording Unit, Thermal Development Unit, Conveyance Assembly, and Output Tray.",
            status: "extracted",
            associatedChunkIds: ["chk-dp-01", "chk-dp-02", "chk-dp-03", "chk-dp-04"],
          },
        ],
      };
    }

    if (equipmentId === "equip-cb-a61") {
      return {
        equipmentId: "equip-cb-a61",
        equipmentName: "Conveyor Belt A61",
        equipmentType: "Modular Belt Conveyor",
        model: "A61-SIMREADY-01",
        generatedAt: new Date().toISOString(),
        versionHash: "cb-a61-v1-hash-9901",
        documents: [
          {
            id: "doc-conveyor-a61",
            title: "SimReady Conveyor Belt A61 Technical Operation & Disassembly Guide",
            revision: "Rev 1.0-OEM",
            filename: "conveyor_belt_a61_manual.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024 * 1024 * 4,
            status: "indexed",
            uploadedById: "mock-user-1",
            ownerName: "Senior Automation Specialist",
            ownerEmail: "conveyors@manuai.internal",
            reviewDate: new Date(Date.now() + 3600000 * 24 * 365).toISOString(),
            isOverdue: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        chunks: [
          {
            id: "chk-04",
            documentId: "doc-conveyor-a61",
            documentTitle: "SimReady Conveyor Belt A61 Technical Operation & Disassembly Guide",
            page: 1,
            section: "1.1 Drive Motor & Planetary Gearbox Assembly",
            text: "The Conveyor Belt A61 drive train comprises a 480V 3-phase high-torque brushless drive motor (sm_conveyor_belt_a61_obj_00) coupled to a sealed helical planetary gearbox (sm_button01/sm_button02 operator start/stop interface). Maintain oil temperature under 65°C and verify 32 Nm flange mount torques during quarterly PM.",
            safetyCategory: "loto_isolation",
            ppeTags: ["safety_glasses", "dielectric_gloves", "steel_toe_boots"],
          },
          {
            id: "chk-05",
            documentId: "doc-conveyor-a61",
            documentTitle: "SimReady Conveyor Belt A61 Technical Operation & Disassembly Guide",
            page: 2,
            section: "2.3 Idler Roller Array & Vulcanized Belt Tensioning",
            text: "The bed features 36 precision-machined stainless idler rollers (sm_roller01 through sm_roller36) supporting a multi-ply high-traction vulcanized belt. Belt tracking must be calibrated using the pneumatic automatic tensioner cylinders (sm_button05/06 pressure regulators) to maintain between 4.2 and 4.8 bar.",
            safetyCategory: "general_procedure",
            ppeTags: ["safety_glasses", "cut_resistant_gloves"],
          },
          {
            id: "chk-06",
            documentId: "doc-conveyor-a61",
            documentTitle: "SimReady Conveyor Belt A61 Technical Operation & Disassembly Guide",
            page: 3,
            section: "3.2 Optical Inspection Scanner & Vision Housing",
            text: "Quality inspection is performed by the top-mounted high-speed optical scanning module (sm_glass_a61_obj_00 lens enclosure). Clean optical glass face with lint-free isopropyl wipes before every 8-hour shift. In case of belt stoppage, engage Emergency Stop console (sm_button04) immediately.",
            safetyCategory: "hazard_warning",
            ppeTags: ["safety_glasses", "esd_wrist_strap"],
          },
        ],
        figures: [
          {
            id: "fig-cb-a61",
            documentId: "doc-conveyor-a61",
            documentTitle: "SimReady Conveyor Belt A61 Technical Operation & Disassembly Guide",
            revision: "Rev 1.0-OEM",
            page: 2,
            figureId: "FIG-CONVEYOR-BELT-A61",
            title: "Conveyor Belt A61 Exploded Assembly & Component Diagram",
            caption: "Detailed 3D SimReady CAD rendering displaying drive motor, idler rollers, tensioners, and optical scanner.",
            status: "extracted",
            associatedChunkIds: ["chk-04", "chk-05", "chk-06"],
          },
        ],
      };
    }

    if (!isConnectedToMongo || !mongoose.Types.ObjectId.isValid(equipmentId)) {
      // Mock fixture area pack for testing/disconnected mode
      return {
        equipmentId: equipmentId || "mock-eq-1",
        equipmentName: "Slurry Pump P-102",
        equipmentType: "Centrifugal Slurry Pump",
        model: "Warman AH 4/3",
        generatedAt: new Date().toISOString(),
        versionHash: "mock-v1-hash-abc1234",
        documents: [
          {
            id: "mock-doc-1",
            title: "Slurry Pump P-102 Maintenance & Overhaul Manual",
            revision: "Rev 2.4",
            filename: "slurry_pump_p102_manual.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024 * 1024 * 3,
            status: "indexed",
            uploadedById: "mock-user-1",
            ownerName: "Chief Reliability Engineer",
            ownerEmail: "reliability@manuai.internal",
            reviewDate: new Date(Date.now() + 3600000 * 24 * 180).toISOString(),
            isOverdue: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        chunks: [
          {
            id: "chunk-1",
            documentId: "mock-doc-1",
            documentTitle: "Slurry Pump P-102 Maintenance & Overhaul Manual",
            page: 12,
            section: "4.1 Mechanical Seal Overhaul",
            text: "Before disassembling the slurry pump wet end, ensure electrical feed 480V disconnect switch is locked and tagged out in accordance with standard plant LOTO procedures. Vent and drain casing completely.",
            safetyCategory: "loto_isolation",
            ppeTags: ["safety_glasses", "dielectric_gloves", "steel_toe_boots"],
          },
          {
            id: "chunk-2",
            documentId: "mock-doc-1",
            documentTitle: "Slurry Pump P-102 Maintenance & Overhaul Manual",
            page: 18,
            section: "4.3 Gland Packing & Seal Bolt Torques",
            text: "Torque gland follower bolts evenly in a cross pattern to 45 ft-lbs (61 Nm). Never over-tighten packing gland as excessive heat will glaze the packing rings and score shaft sleeve.",
            safetyCategory: "general_procedure",
            ppeTags: ["safety_glasses", "leather_gloves"],
          },
          {
            id: "chunk-3",
            documentId: "mock-doc-1",
            documentTitle: "Slurry Pump P-102 Maintenance & Overhaul Manual",
            page: 22,
            section: "5.1 Hazard Warnings: Slurry Abrasion & Trapped Pressure",
            text: "DANGER: Entrapped abrasive slurry under pressure can cause severe chemical or projectile injury. Always bleed casing pressure gauge to 0 PSIG and verify zero flow before loosening casing clamp bolts.",
            safetyCategory: "hazard_warning",
            ppeTags: ["face_shield", "chemical_apron", "heavy_duty_gloves"],
          },
        ],
        figures: [
          {
            id: "mock-fig-1",
            documentId: "mock-doc-1",
            documentTitle: "Slurry Pump P-102 Maintenance & Overhaul Manual",
            revision: "Rev 2.4",
            page: 16,
            figureId: "FIG-P102-EXPLODED",
            title: "Slurry Pump P-102 Exploded Power End & Wet End Assembly",
            caption: "Exploded cross-sectional diagram showing bearing cartridge, mechanical seal, and impeller.",
            status: "extracted",
            associatedChunkIds: ["chunk-1", "chunk-2"],
          },
        ],
      };
    }

    const eq = await Equipment.findById(equipmentId);
    if (!eq) return null;

    const docIds = (eq.documentIds || []).map((id: any) =>
      mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
    );

    const documents = await DocumentModel.find({
      _id: { $in: docIds },
      status: "indexed",
    });

    const validDocIds = documents.map((d) => d._id);
    const chunks = await DocumentChunk.find({
      documentId: { $in: validDocIds },
    }).select("_id documentId documentTitle page section text safetyCategory ppeTags");

    const figures = await DocumentFigure.find({
      documentId: { $in: validDocIds },
      status: "extracted",
    });

    // Compute deterministic version hash
    const hashData = documents
      .map((d) => `${d._id.toString()}:${d.revision}:${d.updatedAt.getTime()}`)
      .sort()
      .join("|");
    const versionHash = crypto.createHash("sha256").update(hashData).digest("hex").slice(0, 16);

    const docDtos: DocumentDTO[] = documents.map((d) => {
      const isOverdue = d.reviewDate ? new Date() > d.reviewDate : false;
      return {
        id: d._id.toString(),
        title: d.title,
        revision: d.revision,
        filename: d.filename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        status: d.status,
        pageCount: d.pageCount,
        processingError: d.processingError,
        uploadedById: d.uploadedById.toString(),
        ownerName: d.ownerName,
        ownerEmail: d.ownerEmail,
        reviewDate: d.reviewDate ? d.reviewDate.toISOString() : undefined,
        isOverdue,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      };
    });

    const chunkDtos: AreaPackChunkDTO[] = chunks.map((c) => ({
      id: c._id.toString(),
      documentId: c.documentId.toString(),
      documentTitle: c.documentTitle,
      page: c.page,
      section: c.section,
      text: c.text,
      safetyCategory: c.safetyCategory as any,
      ppeTags: c.ppeTags,
    }));

    const figureDtos: DocumentFigureDTO[] = figures.map((f) => ({
      id: f._id.toString(),
      documentId: f.documentId.toString(),
      documentTitle: f.documentTitle,
      revision: f.revision,
      page: f.page,
      figureId: f.figureId,
      title: f.title,
      caption: f.caption,
      storagePath: f.storagePath,
      storageProvider: f.storageProvider,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      dimensions: f.dimensions,
      status: f.status,
      associatedChunkIds: f.associatedChunkIds || [],
      createdAt: f.createdAt ? f.createdAt.toISOString() : undefined,
    }));

    return {
      equipmentId: eq._id.toString(),
      equipmentName: eq.name,
      equipmentType: eq.type,
      model: eq.model,
      generatedAt: new Date().toISOString(),
      versionHash,
      documents: docDtos,
      chunks: chunkDtos,
      figures: figureDtos,
    };
  }

  /**
   * Checks whether the client's cached Area Pack is up to date against latest revisions in the database.
   */
  async checkSync(input: SyncCheckInput): Promise<SyncCheckResponseDTO> {
    const pack = await this.getAreaPack(input.equipmentId);
    if (!pack) {
      return {
        equipmentId: input.equipmentId,
        isUpToDate: true,
        latestVersionHash: "none",
        latestRevisionDate: new Date().toISOString(),
      };
    }

    const isUpToDate = Boolean(input.currentVersionHash && input.currentVersionHash === pack.versionHash);

    return {
      equipmentId: input.equipmentId,
      isUpToDate,
      latestVersionHash: pack.versionHash,
      latestRevisionDate: pack.generatedAt,
    };
  }
}

export const offlineService = new OfflineService();
