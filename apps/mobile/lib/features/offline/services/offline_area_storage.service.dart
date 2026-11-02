import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/controllers/auth_controller.dart';
import '../../chat/models/chat_response_model.dart';
import '../../chat/models/citation_model.dart';
import '../../chat/models/safety_preconditions_model.dart';
import '../models/area_pack_model.dart';
import '../../../core/storage/secure_storage_service.dart';

final offlineAreaStorageServiceProvider = Provider<OfflineAreaStorageService>((ref) {
  final secureStorage = ref.watch(secureStorageProvider);
  return OfflineAreaStorageService(secureStorage);
});

class OfflineAreaStorageService {
  final SecureStorageService _storage;
  static const String _keyPrefix = 'area_pack_';

  // In-memory cache for ultra-fast dead zone retrieval
  final Map<String, AreaPackModel> _memoryPacks = {};

  static final AreaPackModel drypixAreaPack = AreaPackModel(
    equipmentId: 'equip-drypix-6000',
    equipmentName: 'Fuji DRYPIX Smart (DRYPIX 6000)',
    equipmentType: 'Dry Laser Imager',
    model: 'DRYPIX Smart (DRYPIX 6000)',
    generatedAt: DateTime.now(),
    versionHash: 'drypix-6000-v8-hash-897n',
    chunks: const [
      AreaPackChunkModel(
        id: 'chk-dp-01',
        documentId: 'doc-drypix-6000',
        documentTitle: 'Fuji DRYPIX Smart Reference Guide',
        page: 58,
        section: '5.4 Error Code List & 5.5.1 Clearing Sheet-Feeder Jam (Err 221/223)',
        text: 'When error code 221 or 223 appears on the operation panel, film has jammed in the sheet-feeder unit (Slot 1 or Slot 2). Clearance Procedure: (1) Open the front cover by pulling outward by the green part. (2) Open the right-side cover. (3) Open the conveyance unit cover inside the right-side cover. (4) Remove the jammed film gently without tearing. (5) Close conveyance cover then right-side cover. (6) Open bottom right-side cover and remove any jammed sheet. (7) Close bottom right-side cover then front cover. The equipment will automatically re-initialize and become ready for printing in 3 to 5 minutes.',
        safetyCategory: 'general_procedure',
        ppeTags: ['antistatic_gloves', 'safety_glasses'],
      ),
      AreaPackChunkModel(
        id: 'chk-dp-02',
        documentId: 'doc-drypix-6000',
        documentTitle: 'Fuji DRYPIX Smart Reference Guide',
        page: 65,
        section: '5.5.3 Clearing Film Jam in Recording Unit (Error 228)',
        text: 'When error code 228 is displayed, film is jammed inside the Laser Recording Unit. Procedure: (1) Open front cover by pulling outward. (2) Slowly turn the right-side green handle clockwise to advance and feed the jammed film. Note: Turning the handle with power off may briefly illuminate the pilot lamp due to motor back-EMF, which is normal. (3) Remove the jammed film sheet. (4) Close front cover firmly. Printer re-initializes within 3 to 5 minutes.',
        safetyCategory: 'hazard_warning',
        ppeTags: ['safety_glasses', 'cleanroom_gloves'],
      ),
      AreaPackChunkModel(
        id: 'chk-dp-03',
        documentId: 'doc-drypix-6000',
        documentTitle: 'Fuji DRYPIX Smart Reference Guide',
        page: 66,
        section: '5.5.4 Clearing Film Jam in Thermal Development Unit (Error 230)',
        text: 'Error code 230 indicates film is jammed in the Thermal Development Unit. CAUTION: HIGH TEMPERATURE HAZARD. The thermal development drum operates at elevated temperatures; avoid touching heating surfaces. Procedure: (1) Open front cover. (2) Slowly turn the right-side handle clockwise and left-side handle counterclockwise one by one until the film end emerges. If film is hidden, turn left-side handle clockwise to eject through discharge unit. (3) Remove film sheet. (4) Close front cover firmly. Machine resumes in 3 to 5 minutes.',
        safetyCategory: 'hazard_warning',
        ppeTags: ['thermal_gloves', 'safety_glasses'],
      ),
      AreaPackChunkModel(
        id: 'chk-dp-04',
        documentId: 'doc-drypix-6000',
        documentTitle: 'Fuji DRYPIX Smart Reference Guide',
        page: 35,
        section: '3.2 Replacing Film Pack (DI-HL / DI-ML Film)',
        text: 'When film counter reaches 0, display shows EP1 or EP2. Load Fuji Medical Dry Laser Image Film DI-HL or DI-ML. Procedure: (1) Press Enter button to unlock tray; display shows oPn. (2) Pull out film tray carefully, discard protective sheet and cardboard. (3) Place new film pack with arrow pointing to back of tray. (4) Tear label and open both pack ends. (5) Use film cutter stored on right side of operation panel to cut film pack along tray edge. (6) Slowly push tray until it clicks and locks (PUL). (7) Gently pull outer plastic wrapper straight out toward you. Automatic film density calibration runs automatically.',
        safetyCategory: 'general_procedure',
        ppeTags: ['cleanroom_gloves'],
      ),
      AreaPackChunkModel(
        id: 'chk-dp-05',
        documentId: 'doc-drypix-6000',
        documentTitle: 'Fuji DRYPIX Smart Reference Guide',
        page: 38,
        section: '3.3 Replacing Film Trays with Light-Tight Shutter',
        text: 'Supported tray sizes: 14x17", 14x14", 10x14", 10x12", and 8x10". When removing a tray containing film, the metal light-tight shutter (stored on rear of unit) must be inserted completely into the top slit of the film tray. Press Enter to unlock (oPn). Pull tray out with both hands (weight ~8 kg). Insert target tray firmly until PUL appears, then withdraw and store shutter in rear pocket.',
        safetyCategory: 'general_procedure',
        ppeTags: ['safety_shoes'],
      ),
      AreaPackChunkModel(
        id: 'chk-dp-06',
        documentId: 'doc-drypix-6000',
        documentTitle: 'Fuji DRYPIX Smart Reference Guide',
        page: 44,
        section: '4.4 Utility U-1: Auto Film Density Calibration & QC Patterns',
        text: 'Utility Menu: Press Utility button to cycle: U-1 (Auto film density calibration - prints step wedge on 14x17" or 26x36cm and scans with internal densitometer); U-2 (Output QC test pattern); U-3 (Reset film counter); U-4 (Sensitive material parameters); U-5 (Clock setup); U-6 (SMPTE 1-5 test pattern for DICOM grayscale calibration); U-7 (Mammography QC pattern TG18-QC/PQC). Press Enter to select slot and execute.',
        safetyCategory: 'general_procedure',
        ppeTags: [],
      ),
      AreaPackChunkModel(
        id: 'chk-dp-07',
        documentId: 'doc-drypix-6000',
        documentTitle: 'Fuji DRYPIX Smart Reference Guide',
        page: 13,
        section: '1.2 Laser Safety & Error Code 213/214 Notification',
        text: 'Class 3B semiconductor laser operating at 659 nm wavelength, 130 mW CW output (IEC 60825-1 Class 1 Laser Product). Never defeat door interlocks or expose eyes to laser cavity. When error code 213 appears, the operating life of the laser diode is approaching expiration (approx 1 month remaining). When error code 214 appears, laser life has expired and dealer servicing is required.',
        safetyCategory: 'hazard_warning',
        ppeTags: ['safety_glasses'],
      ),
      AreaPackChunkModel(
        id: 'chk-dp-08',
        documentId: 'doc-drypix-6000',
        documentTitle: 'Fuji DRYPIX Smart Reference Guide',
        page: 72,
        section: '6.1.3 Weekly Care: Washing Conveyance Cleaning Roller with Water',
        text: 'Weekly: Wash the conveyance cleaning roller with running tap water to remove lint and dust preventing white blurred streaks on film prints. Wipe with ethanol anhydride gauze and dry completely before re-inserting. Every 3 months: Slide out air filter at rear of right-side cover and vacuum accumulated dust. Do not use ethanol on barcode reader filter.',
        safetyCategory: 'general_procedure',
        ppeTags: ['lint_free_gloves'],
      ),
    ],
  );


  OfflineAreaStorageService(this._storage);

  /// Saves a downloaded Area Pack to local storage
  Future<void> saveAreaPack(AreaPackModel pack) async {
    _memoryPacks[pack.equipmentId] = pack;
    try {
      final jsonStr = jsonEncode(pack.toJson());
      await _storage.write('$_keyPrefix${pack.equipmentId}', jsonStr);
    } catch (_) {
      // Memory cache is preserved
    }
  }

  /// Retrieves cached Area Pack for equipment
  Future<AreaPackModel?> getAreaPack(String equipmentId) async {
    if (equipmentId == 'equip-drypix-6000' || equipmentId.toLowerCase().contains('drypix') || equipmentId.contains('6000')) {
      return drypixAreaPack;
    }
    if (_memoryPacks.containsKey(equipmentId)) {
      return _memoryPacks[equipmentId];
    }

    try {
      final raw = await _storage.read('$_keyPrefix$equipmentId');
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw) as Map<String, dynamic>;
        final pack = AreaPackModel.fromJson(decoded);
        _memoryPacks[equipmentId] = pack;
        return pack;
      }
    } catch (_) {}

    return null;
  }

  /// Checks if equipment has an offline area pack cached
  Future<bool> hasOfflinePack(String equipmentId) async {
    if (equipmentId == 'equip-drypix-6000' || equipmentId.toLowerCase().contains('drypix') || equipmentId.contains('6000')) {
      return true;
    }
    if (_memoryPacks.containsKey(equipmentId)) return true;
    final raw = await _storage.read('$_keyPrefix$equipmentId');
    return raw != null && raw.isNotEmpty;
  }

  /// Client-side Dead-Zone Retrieval Engine:
  /// Performs BM25-like term frequency and token matching across cached manual chunks.
  Future<ChatResponseModel> searchOfflinePassages(
    String equipmentId,
    String query, {
    String? equipmentName,
  }) async {
    final pack = await getAreaPack(equipmentId);
    final eqTitle = equipmentName ?? pack?.equipmentName ?? 'Plant Equipment';

    if (pack == null || pack.chunks.isEmpty) {
      return ChatResponseModel(
        answer:
            '> 📴 **OFFLINE RETRIEVAL-ONLY MODE (DEAD ZONE)**\n\n'
            'No offline documentation pack is cached on this device for **$eqTitle**.\n\n'
            'When network connectivity is restored, tap **Download Area Pack** to store approved SOPs and diagrams for offline plant use.',
        warningLevel: 'caution',
        confidenceScore: 0.1,
        provider: 'offline-dead-zone-cache',
        suggestedTicket: SuggestedTicketModel(
          query: query,
          equipmentId: equipmentId,
          reason: 'Offline dead zone: no area pack cached for $eqTitle',
        ),
      );
    }

    final queryWords = query
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
        .split(RegExp(r'\s+'))
        .where((w) => w.length > 2)
        .toList();

    // Score cached chunks based on query term frequency and section titles
    final scoredChunks = <MapEntry<AreaPackChunkModel, double>>[];
    for (final chunk in pack.chunks) {
      double score = 0.0;
      final textLower = chunk.text.toLowerCase();
      final secLower = (chunk.section ?? '').toLowerCase();

      for (final word in queryWords) {
        if (textLower.contains(word)) score += 1.0;
        if (secLower.contains(word)) score += 2.0;
      }

      // Bonus if chunk is a hazard or LOTO step
      if (chunk.safetyCategory == 'loto_isolation') score += 0.5;
      if (chunk.safetyCategory == 'hazard_warning') score += 0.5;

      if (score > 0) {
        scoredChunks.add(MapEntry(chunk, score));
      }
    }

    scoredChunks.sort((a, b) => b.value.compareTo(a.value));
    final topChunks = scoredChunks.take(3).map((e) => e.key).toList();

    if (topChunks.isEmpty) {
      // Fallback to first 2 chunks of manual if no keyword match
      topChunks.addAll(pack.chunks.take(2));
    }

    // Extract safety preconditions from the matched or primary chunks
    final warnings = <String>[];
    final ppeSet = <String>{};
    final lotoSteps = <String>[];

    for (final c in pack.chunks) {
      if (c.safetyCategory == 'hazard_warning' && warnings.length < 3) {
        warnings.add(c.text.length > 200 ? '${c.text.substring(0, 200)}...' : c.text);
      }
      if (c.safetyCategory == 'loto_isolation' && lotoSteps.length < 3) {
        lotoSteps.add(c.text.length > 200 ? '${c.text.substring(0, 200)}...' : c.text);
      }
      ppeSet.addAll(c.ppeTags);
    }

    final citations = topChunks
        .map(
          (c) => CitationModel(
            documentId: c.documentId,
            documentTitle: c.documentTitle,
            revision: 'Offline Cached Pack',
            page: c.page,
            section: c.section,
            excerpt: c.text,
            safetyCategory: c.safetyCategory,
          ),
        )
        .toList();

    final buffer = StringBuffer();
    buffer.writeln('> 📴 **[OFFLINE DEAD-ZONE FALLBACK: DIRECT MANUAL PASSAGES]**');
    buffer.writeln(
      '> Cloud LLM is unreachable. Serving ranked, verified SOP passages directly from cached local memory for **$eqTitle**.\n',
    );

    for (var i = 0; i < topChunks.length; i++) {
      final c = topChunks[i];
      buffer.writeln('### [Passage ${i + 1}] ${c.documentTitle} (Page ${c.page})');
      if (c.section != null) buffer.writeln('*Section: ${c.section}*');
      buffer.writeln('\n> ${c.text}\n');
    }

    return ChatResponseModel(
      answer: buffer.toString(),
      citations: citations,
      warningLevel: lotoSteps.isNotEmpty || warnings.isNotEmpty ? 'critical' : 'none',
      confidenceScore: 0.80,
      provider: 'client-offline-dead-zone-cache',
      safetyPreconditions: SafetyPreconditionsModel(
        warnings: warnings,
        ppeRequired: ppeSet.toList(),
        lotoSteps: lotoSteps,
        isOverdueWarning: null,
      ),
    );
  }
}

