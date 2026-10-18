import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Equipment, DocumentModel, DocumentChunk, DocumentPermission, AuditEvent } from "../models";
import { generateDeterministicEmbedding } from "../services/gemini.service";
import { env } from "./env";

export async function seedDatabase() {
  try {
    const isProduction = env.NODE_ENV === "production";
    if (isProduction && process.env.ALLOW_INITIAL_SEED !== "true") {
      console.log("[Seed] Production mode active: automatic demo account creation is disabled. Set ALLOW_INITIAL_SEED=true with INITIAL_SEED_PASSWORD to seed.");
      return;
    }

    const userCount = await User.countDocuments();
    const seedPassword = process.env.INITIAL_SEED_PASSWORD;

    let adminUser = await User.findOne({ email: "admin@plant.io" });
    let leadEngineer = await User.findOne({ email: "alex.mercer@plant.io" });

    if (userCount > 0) {
      console.log(`[Seed] User accounts already exist (${userCount} users). Preserving existing credentials (idempotent; no password overwrite).`);
    } else if (!seedPassword) {
      console.log("[Seed] Skipping initial personnel creation: INITIAL_SEED_PASSWORD environment variable is not provided.");
    } else {
      console.log("[Seed] Initializing personnel accounts with securely supplied INITIAL_SEED_PASSWORD...");
      const passwordHash = await bcrypt.hash(seedPassword, 10);

      adminUser = await User.create({
        name: "Elena Rostova",
        email: "admin@plant.io",
        passwordHash,
        role: "admin",
        orgId: "plant-alpha",
      });

      leadEngineer = await User.create({
        name: "Alex Mercer",
        email: "alex.mercer@plant.io",
        passwordHash,
        role: "engineer",
        orgId: "plant-alpha",
      });

      const techUser = await User.create({
        name: "Marcus Vance",
        email: "marcus.v@plant.io",
        passwordHash,
        role: "viewer",
        orgId: "plant-alpha",
      });

      console.log(`[Seed] Created initial verified accounts: ${adminUser.email}, ${leadEngineer.email}, ${techUser.email}`);
    }

    // In production, skip automatic demo equipment and document creation unless explicitly allowed
    if (isProduction && process.env.ALLOW_INITIAL_SEED !== "true") {
      return;
    }

    // Seed equipment if empty
    const eqCount = await Equipment.countDocuments();
      let pumpId: string | null = null;
      if (eqCount === 0) {
        console.log("[Seed] Seeding equipment registry...");
        const pump = await Equipment.create({
          name: "Centrifugal Slurry Pump P-102",
          type: "Centrifugal Pump",
          model: "SP-400 Heavy Duty",
          manufacturer: "Flowserve",
          serialNumber: "FS-2023-9981",
          location: "Line 1 - Slurry Preparation",
          documentIds: [],
        });
        pumpId = pump._id.toString();

        await Equipment.create({
          name: "Rotary Screw Air Compressor AC-300",
          type: "Air Compressor",
          model: "Atlas Copco GA-90+",
          manufacturer: "Atlas Copco",
          serialNumber: "AC-8812-B",
          location: "Utility Room B",
          documentIds: [],
        });

        await Equipment.create({
          name: "Hydraulic Stamping Press HP-400",
          type: "Hydraulic Press",
          model: "Schuler 400-T",
          manufacturer: "Schuler Pressen",
          serialNumber: "SC-400-091",
          location: "Line 3 - Main Fabrication",
          documentIds: [],
        });
      }

      // Seed baseline document and chunks if empty
      const docCount = await DocumentModel.countDocuments();
      if (docCount === 0) {
        console.log("[Seed] Seeding authorized equipment manuals and SOPs...");
        const anyUser = await User.findOne();
        const uploaderId = leadEngineer?._id || adminUser?._id || anyUser?._id || new mongoose.Types.ObjectId();

        const doc1 = await DocumentModel.create({
          title: "Centrifugal Slurry Pump Maintenance & Rebuild Manual",
          revision: "Rev 4.1",
          filename: "slurry_pump_manual_rev4.pdf",
          storagePath: "seed_slurry_pump_manual.pdf",
          mimeType: "application/pdf",
          sizeBytes: 12450000,
          status: "indexed",
          pageCount: 148,
          equipmentId: pumpId ? (pumpId as any) : undefined,
          tags: ["Mechanical", "Hydraulics", "Shaft Seals", "Torque Specs"],
          uploadedById: uploaderId,
        });

        const doc2 = await DocumentModel.create({
          title: "Standard Operating Procedure: Hydraulic Lockout Tagout (LOTO)",
          revision: "Rev 8.0",
          filename: "sop_loto_hydraulic_press.pdf",
          storagePath: "seed_sop_loto.pdf",
          mimeType: "application/pdf",
          sizeBytes: 3100000,
          status: "indexed",
          pageCount: 24,
          tags: ["Safety", "LOTO", "High Pressure", "OSHA 1910.147"],
          uploadedById: uploaderId,
        });

        const doc3 = await DocumentModel.create({
          title: "Rotary Screw Air Compressor Operator Guide",
          revision: "Rev 2.3",
          filename: "rotary_compressor_manual.pdf",
          storagePath: "seed_rotary_compressor.pdf",
          mimeType: "application/pdf",
          sizeBytes: 8750000,
          status: "indexed",
          pageCount: 86,
          tags: ["Compressor", "Pneumatics", "Fault Codes"],
          uploadedById: uploaderId,
        });

        // Seed real vector chunks
        const CHUNK_TEXT_1 = "Mechanical seal replacement on Slurry Pump Model SP-400 requires complete casing depressurization. Tighten four M12 gland retaining nuts in cross-diagonal sequence to 45 N·m. Maximum permissible shaft runout is 0.05 mm. Use FG-2 silicone lubricant for Viton O-rings.";
        const CHUNK_TEXT_2 = "Lockout Tagout (LOTO) procedure per OSHA 1910.147. Before servicing hydraulic press HP-400 or centrifugal pump systems, technician must close manual ball valve V-101, apply padlocks, and vent accumulator manifold pressure until zero reading is verified on calibrated test gauge.";
        const CHUNK_TEXT_3 = "Fault Code E-0247 indicates hydraulic or pneumatic valve stiction or differential pressure exceeding 1.2 bar across the coalescing separator filter. Inspect scavenging line orifice and verify lubricant level before restarting compressor.";

        await DocumentChunk.create({
          documentId: doc1._id,
          documentTitle: doc1.title,
          revision: doc1.revision,
          page: 16,
          section: "4.2 Mechanical Seal Rebuild & Dual Cartridge Alignment",
          text: CHUNK_TEXT_1,
          embedding: generateDeterministicEmbedding(CHUNK_TEXT_1),
          tokenCount: 65,
        });

        await DocumentChunk.create({
          documentId: doc2._id,
          documentTitle: doc2.title,
          revision: doc2.revision,
          page: 12,
          section: "3.1 Lockout Tagout Verification",
          text: CHUNK_TEXT_2,
          embedding: generateDeterministicEmbedding(CHUNK_TEXT_2),
          tokenCount: 58,
        });

        await DocumentChunk.create({
          documentId: doc3._id,
          documentTitle: doc3.title,
          revision: doc3.revision,
          page: 44,
          section: "Fault Code E-0247 & Discharge High Temp",
          text: CHUNK_TEXT_3,
          embedding: generateDeterministicEmbedding(CHUNK_TEXT_3),
          tokenCount: 60,
        });

        if (adminUser) {
          await AuditEvent.create({
            userId: adminUser._id,
            userEmail: adminUser.email,
            action: "doc_upload",
            resourceType: "Document",
            resourceId: doc1._id.toString(),
            details: { title: doc1.title, revision: doc1.revision },
          });
        }

        console.log("[Seed] Ingestion and vector embeddings seeded successfully in MongoDB.");
      }

      // Ensure baseline document permissions exist for plant personnel
      const permCount = await DocumentPermission.countDocuments();
      if (permCount === 0) {
        const docs = await DocumentModel.find();
        for (const doc of docs) {
          await DocumentPermission.create({
            documentId: doc._id,
            role: "engineer",
            canRead: true,
            canWrite: true,
          });
          await DocumentPermission.create({
            documentId: doc._id,
            role: "viewer",
            canRead: true,
            canWrite: false,
          });
        }
        console.log(`[Seed] Seeded baseline role permissions for ${docs.length} equipment manuals.`);
      }
  } catch (err) {
    console.warn("[Seed] Database seed notice:", err);
  }
}

if (require.main === module) {
  const { connectDatabase } = require("./database");
  connectDatabase()
    .then(async (connected: boolean) => {
      if (connected) {
        await seedDatabase();
        process.exit(0);
      } else {
        console.error("[Seed CLI] Failed to connect to MongoDB.");
        process.exit(1);
      }
    })
    .catch((err: unknown) => {
      console.error("[Seed CLI] Error during database seeding:", err);
      process.exit(1);
    });
}
