// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'MAN-U-AI';

  @override
  String get loginTitle => 'OPERATOR LOGIN';

  @override
  String get loginSubtitle => 'Sign in to your industrial copilot terminal';

  @override
  String get emailLabel => 'WORK EMAIL';

  @override
  String get emailHint => 'engineer@plant.com';

  @override
  String get passwordLabel => 'PASSWORD';

  @override
  String get passwordHint => 'Enter your password';

  @override
  String get signInButton => 'AUTHENTICATE & ENTER';

  @override
  String get registeringTitle => 'NEW ACCOUNT';

  @override
  String get registerButton => 'REGISTER ACCOUNT';

  @override
  String get fullNameLabel => 'FULL NAME';

  @override
  String get roleLabel => 'ASSIGNED ROLE';

  @override
  String get roleEngineer => 'Field Reliability Engineer';

  @override
  String get rolePlantManager => 'Plant Operations Manager';

  @override
  String get roleSupervisor => 'Maintenance Supervisor';

  @override
  String get roleOperator => 'Floor Operator';

  @override
  String get invalidCredentials => 'Invalid email or password.';

  @override
  String get loggingIn => 'Authenticating...';

  @override
  String get alreadyHaveAccount => 'Already registered? Sign in';

  @override
  String get needAccount => 'Need access? Request registration';

  @override
  String get consultations => 'CONSULTATION SESSIONS';

  @override
  String get newConsultation => 'NEW CONSULTATION';

  @override
  String get searchSessions => 'Search sessions...';

  @override
  String get todayShiftTasks => 'TODAY\'S SHIFT TASKS';

  @override
  String get floorMaintenance => 'Floor maintenance & checklist';

  @override
  String get noConsultations => 'No active consultation records found';

  @override
  String get activeConsultation => 'ACTIVE';

  @override
  String get settingsTitle => 'SETTINGS & PREFERENCES';

  @override
  String get signOut => 'Sign out';

  @override
  String get confirmSignOut => 'Are you sure you want to sign out?';

  @override
  String get typeMessageHint =>
      'Ask MAN-U-AI about machine SOPs, manuals, fault codes...';

  @override
  String get sendTooltip => 'Send message';

  @override
  String get cameraTooltip => 'Take photo or record video';

  @override
  String get mediaUploadTooltip => 'Upload technical photos or videos';

  @override
  String get pickEquipmentTooltip => 'Select plant equipment';

  @override
  String get plantGlossaryTooltip => 'Plant Glossary & Slang';

  @override
  String get diagramTooltip => 'Interactive Exploded Diagram';

  @override
  String get deadZoneMode => 'Dead-Zone Mode Active';

  @override
  String get onlineMode => 'Online // Connected to MAN-U-AI Cloud';

  @override
  String get reconnectingMode => 'Connection Restored // Synchronizing Data';

  @override
  String get serverUnavailableMode =>
      'Server Unavailable // Local Procedures Only';

  @override
  String get emptyChatTitle => 'READY FOR INDUSTRIAL CONSULTATION';

  @override
  String get emptyChatSubtitle =>
      'Select an equipment unit or ask about safety procedures, fault codes, or maintenance steps.';

  @override
  String get suggestedPrompt1 =>
      'Explain SOP for Slurry Pump P-102 seal replacement';

  @override
  String get suggestedPrompt2 =>
      'What are the LOTO isolation points for Conveyor A61?';

  @override
  String get suggestedPrompt3 =>
      'Diagnose high vibration on Centrifugal Pump bearing';

  @override
  String get thinkingIndicator =>
      'Analyzing technical manuals and telemetry...';

  @override
  String get citationsTitle => 'DOCUMENT SOURCES & SOP CITATIONS';

  @override
  String get pageLabel => 'Page';

  @override
  String get confidenceLabel => 'Confidence';

  @override
  String get safetyNoticeTitle => 'SAFETY & COMPLIANCE NOTICE';

  @override
  String get safetyNoticeContent =>
      'Always follow Lockout/Tagout (LOTO) protocols and verify zero energy state before mechanical disassembly.';

  @override
  String get cadViewerTitle => '3D Machine Structure Explorer';

  @override
  String get sequentialExplodedView => 'Sequential Exploded View';

  @override
  String stageStepLabel(int current, int total) {
    return 'Stage $current of $total';
  }

  @override
  String get previousStage => 'Previous Stage';

  @override
  String get nextStage => 'Next Stage';

  @override
  String get resetAssembly => 'Reset Assembly';

  @override
  String get continuousSlider => 'Continuous Explosion';

  @override
  String get selectedComponent => 'Selected Component';

  @override
  String get componentDetails => 'Component Details';

  @override
  String get tapComponentPrompt =>
      'Tap any component to inspect details and ask AI';

  @override
  String get askAiAboutComponent => 'Ask AI about this component';

  @override
  String get isolationSteps => 'Isolation & Disassembly Steps';

  @override
  String get loadingCadModel => 'Loading CAD 3D Model...';

  @override
  String get cadModelLoadError => 'Unable to load CAD model.';

  @override
  String get evidenceTitle => 'EVIDENCE TITLE';

  @override
  String get evidenceTitleHint => 'e.g. Slurry Pump Seal Leakage Inspection';

  @override
  String get observationsTitle => 'OBSERVATIONS & DIAGNOSTIC NOTES (OPTIONAL)';

  @override
  String get observationsHint =>
      'Note vibration, overheating, acoustic anomalies, or part wear...';

  @override
  String get selectEquipmentDropdown => 'ASSOCIATED EQUIPMENT';

  @override
  String get selectEquipmentPrompt => 'Select equipment unit...';

  @override
  String get addPhotos => 'ADD PHOTOS';

  @override
  String get addVideos => 'ADD VIDEOS';

  @override
  String get uploadEvidence => 'UPLOAD EVIDENCE';

  @override
  String get uploadingMedia => 'Uploading media evidence...';

  @override
  String get uploadSuccess => 'Media uploaded and linked successfully!';

  @override
  String get uploadFailed => 'Media upload failed. Please try again.';

  @override
  String get takePhotoOption => 'Take Photo';

  @override
  String get recordVideoOption => 'Record Video';

  @override
  String get galleryOption => 'Choose from Gallery';

  @override
  String get equipmentDetailsTitle => 'EQUIPMENT SPECIFICATIONS';

  @override
  String get equipmentStatusNormal => 'NORMAL';

  @override
  String get equipmentStatusWarning => 'WARNING';

  @override
  String get equipmentStatusCritical => 'CRITICAL';

  @override
  String get operatingTemperature => 'Operating Temperature';

  @override
  String get pressureReadout => 'Operating Pressure';

  @override
  String get vibrationLevel => 'Vibration Level';

  @override
  String get motorSpeed => 'Motor Speed (RPM)';

  @override
  String get lastMaintenance => 'Last Maintenance';

  @override
  String get nextScheduled => 'Next Scheduled Inspection';

  @override
  String get downloadAreaPack => 'Download Offline Area Pack';

  @override
  String get areaPackDownloaded => 'Area pack stored for offline use.';

  @override
  String get shiftTasksTitle => 'Shift Maintenance Tasks';

  @override
  String get priorityHigh => 'HIGH PRIORITY';

  @override
  String get priorityMedium => 'MEDIUM';

  @override
  String get priorityLow => 'LOW';

  @override
  String get markAsCompleted => 'Mark Completed';

  @override
  String get completedStatus => 'COMPLETED';

  @override
  String get pendingStatus => 'PENDING';

  @override
  String get noTasksToday => 'No maintenance tasks scheduled for this shift.';

  @override
  String get documentsTitle => 'TECHNICAL DOCUMENTS & SOPS';

  @override
  String get manualsTab => 'Manuals';

  @override
  String get sopsTab => 'SOPs';

  @override
  String get schematicsTab => 'Schematics';

  @override
  String get searchDocumentsHint => 'Search documents and manuals...';

  @override
  String get ingestionStatus => 'Ingestion Status';

  @override
  String get indexedPages => 'Indexed Pages';

  @override
  String get uploadDocumentPrompt => 'Upload Manual / PDF';

  @override
  String get settingsHeader => 'SETTINGS';

  @override
  String get appearanceSection => 'APPEARANCE';

  @override
  String get lightMode => 'Light Mode';

  @override
  String get lightModeDescription =>
      'Clean high-contrast technical light interface';

  @override
  String get darkMode => 'Dark Mode';

  @override
  String get darkModeDescription => 'Industrial low-glare dark workspace';

  @override
  String get systemDefault => 'System Default';

  @override
  String get systemDefaultDescription => 'Match operating system appearance';

  @override
  String get languageSection => 'LANGUAGE / भाषा';

  @override
  String get englishLanguage => 'English';

  @override
  String get englishLanguageSubtitle => 'Industrial Technical English';

  @override
  String get hindiLanguage => 'हिन्दी (Hindi)';

  @override
  String get hindiLanguageSubtitle =>
      'औद्योगिक एवं यांत्रिक शब्दावली (Technical Hindi)';

  @override
  String get userAccountSection => 'USER ACCOUNT';

  @override
  String get activeRole => 'Active Role';

  @override
  String get sessionToken => 'Session';

  @override
  String get activeSession => 'Authenticated';

  @override
  String get appInfoSection => 'APPLICATION INFORMATION';

  @override
  String get appVersion => 'Version 2.4.0 (Build 2026.11)';

  @override
  String get offlineCacheTitle => 'Offline Storage & Area Packs';

  @override
  String get clearCacheButton => 'Clear Offline Cache';

  @override
  String get cacheClearedNotice => 'Offline cache cleared successfully.';

  @override
  String get cancel => 'Cancel';

  @override
  String get save => 'Save';

  @override
  String get confirm => 'Confirm';

  @override
  String get close => 'Close';

  @override
  String get delete => 'Delete';

  @override
  String get retry => 'Retry';

  @override
  String get errorTitle => 'Error';

  @override
  String get genericError => 'An unexpected error occurred. Please try again.';

  @override
  String get networkError =>
      'Network connection unavailable. Operating in offline mode.';

  @override
  String get offlineWarning =>
      'Dead zone detected: AI features will use cached manuals.';

  @override
  String get slurryPumpTitle => 'Centrifugal Slurry Pump P-102';

  @override
  String get conveyorBeltTitle => 'Overland Conveyor Belt A61';

  @override
  String get hydraulicPressTitle => 'Hydraulic Stamping Press H-400';

  @override
  String get compressorUnitTitle => 'Rotary Screw Compressor C-12';

  @override
  String get heatExchangerTitle => 'Shell & Tube Heat Exchanger E-301';

  @override
  String get industrialFanTitle => 'Induced Draft Exhaust Fan F-505';

  @override
  String get equipmentStatus => 'Equipment Status';

  @override
  String get operationalState => 'OPERATIONAL';

  @override
  String get degradedState => 'DEGRADED';

  @override
  String get trippedState => 'TRIPPED';

  @override
  String get offlineState => 'OFFLINE';

  @override
  String get maintenanceDue => 'MAINTENANCE DUE';

  @override
  String get assetTag => 'Asset Tag';

  @override
  String get serialNumber => 'Serial Number';

  @override
  String get manufacturer => 'Manufacturer';

  @override
  String get modelYear => 'Model Year';

  @override
  String get ratedCapacity => 'Rated Capacity';

  @override
  String get operatingHours => 'Operating Hours';

  @override
  String get telemetryHeader => 'REAL-TIME TELEMETRY READOUTS';

  @override
  String get bearingVibration => 'Bearing Vibration';

  @override
  String get casingVibration => 'Casing Vibration';

  @override
  String get suctionPressure => 'Suction Pressure';

  @override
  String get dischargePressure => 'Discharge Pressure';

  @override
  String get windingTemperature => 'Motor Winding Temp';

  @override
  String get oilTemperature => 'Lube Oil Temp';

  @override
  String get bearingTemperature => 'Drive Bearing Temp';

  @override
  String get flowRate => 'Volumetric Flow Rate';

  @override
  String get powerConsumption => 'Current Power Draw';

  @override
  String get unitPsi => 'PSI';

  @override
  String get unitBar => 'bar';

  @override
  String get unitKpa => 'kPa';

  @override
  String get unitRpm => 'RPM';

  @override
  String get unitCelsius => '°C';

  @override
  String get unitFahrenheit => '°F';

  @override
  String get unitMmPerSec => 'mm/s RMS';

  @override
  String get unitKw => 'kW';

  @override
  String get unitAmps => 'A';

  @override
  String get unitVolts => 'V';

  @override
  String get unitHours => 'hrs';

  @override
  String get lotoProtocolTitle => 'LOCKOUT / TAGOUT (LOTO) PROCEDURE';

  @override
  String get lotoStep1 => '1. Notify affected personnel of equipment shutdown.';

  @override
  String get lotoStep2 =>
      '2. Execute controlled shutdown from local control panel.';

  @override
  String get lotoStep3 => '3. Isolate main 480V circuit breaker at MCC-02.';

  @override
  String get lotoStep4 => '4. Apply personal safety padlock and danger tag.';

  @override
  String get lotoStep5 => '5. Depressurize hydraulic and pneumatic lines.';

  @override
  String get lotoStep6 =>
      '6. Verify zero energy state using calibrated multimeter.';

  @override
  String get zeroEnergyVerified => 'Zero Energy State Verified';

  @override
  String get ppeRequiredTitle =>
      'MANDATORY PERSONAL PROTECTIVE EQUIPMENT (PPE)';

  @override
  String get ppeHardHat => 'Hard Hat (ANSI Z89.1)';

  @override
  String get ppeSafetyGlasses => 'Safety Glasses with Side Shields';

  @override
  String get ppeEarProtection => 'Hearing Protection (NRR 28+ dB)';

  @override
  String get ppeSteelToeBoots => 'Steel Toe Work Boots';

  @override
  String get ppeHeatResistantGloves => 'Heavy Duty Mechanics Gloves';

  @override
  String get hazardArcFlash => 'DANGER: Arc Flash & Shock Hazard';

  @override
  String get hazardHighPressure =>
      'WARNING: High Pressure Fluid Injection Hazard';

  @override
  String get hazardRotatingMachinery => 'CAUTION: Rotating Mechanical Shafts';

  @override
  String get hazardHotSurfaces => 'CAUTION: Hot Surfaces Exceeding 70°C';

  @override
  String get emergencyStopTriggered => 'EMERGENCY STOP (E-STOP) ACTIVATED';

  @override
  String get permitToWorkRequired =>
      'Safe Work Permit (SWP) Required Prior to Entry';

  @override
  String get impellerComponent => 'Closed Shrouded Impeller';

  @override
  String get mechanicalSealComponent => 'Cartridge Mechanical Seal';

  @override
  String get shaftComponent => 'Forged Alloy Drive Shaft';

  @override
  String get suctionCoverComponent => 'Suction Liner Plate';

  @override
  String get voluteCasingComponent => 'Heavy Duty Volute Casing';

  @override
  String get bearingHousingComponent => 'Grease Lubricated Bearing Housing';

  @override
  String get wearRingComponent => 'Replaceable Bronze Wear Ring';

  @override
  String get stuffingBoxComponent => 'High Pressure Stuffing Box';

  @override
  String get lanternRingComponent => 'PTFE Flush Lantern Ring';

  @override
  String get couplingComponent => 'Flexible Jaw Coupling';

  @override
  String get gasketComponent => 'Spiral Wound Metallic Gasket';

  @override
  String get oRingComponent => 'Fluoroelastomer O-Ring Seal';

  @override
  String get componentTorqueSpecs => 'Bolt Torque Specifications';

  @override
  String get torqueNm => 'N·m';

  @override
  String get torqueFootPounds => 'ft-lb';

  @override
  String get assemblyOverview => 'Assembly Hierarchy & Sub-components';

  @override
  String get disassemblySequence => 'Safe Disassembly Sequence';

  @override
  String get reassemblySequence => 'Standard Reassembly Sequence';

  @override
  String get inspectionTolerances => 'Clearance & Runout Tolerances';

  @override
  String get diagnosticsTitle => 'GUIDED INDUSTRIAL FAULT DIAGNOSTICS';

  @override
  String get symptomSelectorTitle => 'Select Observed Symptom';

  @override
  String get symptomHighVibration => 'Abnormal vibration exceeding 4.5 mm/s';

  @override
  String get symptomExcessiveHeat => 'Bearing temperature alarm (>85°C)';

  @override
  String get symptomCavitation =>
      'Cavitation noise (popping / marbles in casing)';

  @override
  String get symptomLowFlow => 'Discharge flow rate below operational curve';

  @override
  String get symptomSealLeakage => 'Fluid weeping from mechanical seal gland';

  @override
  String get symptomMotorOverload => 'Motor thermal overload trip';

  @override
  String get rootCauseAnalysis => 'Probable Root Causes';

  @override
  String get recommendedAction => 'Recommended Corrective Action';

  @override
  String get estimatedRepairTime => 'Estimated Downtime / Repair Time';

  @override
  String get toolsRequiredTitle => 'Specialized Tools Required';

  @override
  String get replacementPartsTitle => 'Recommended Replacement Parts';

  @override
  String get searchSopHint => 'Search SOP, schematics, or equipment code...';

  @override
  String get filterAll => 'All Documents';

  @override
  String get filterManuals => 'OEM Manuals';

  @override
  String get filterSops => 'Maintenance SOPs';

  @override
  String get filterElectrical => 'Single Line & Electrical';

  @override
  String get filterPid => 'P&ID Flow Schematics';

  @override
  String get documentSize => 'File Size';

  @override
  String get documentPages => 'Total Pages';

  @override
  String get documentUploaded => 'Upload Date';

  @override
  String get documentVerified => 'Engineering Verified';

  @override
  String get downloadPdf => 'Download Technical PDF';

  @override
  String get openDocument => 'View Document in Viewer';

  @override
  String get uploadSopDocument => 'Ingest New Engineering SOP';

  @override
  String get ingestionProgress => 'Extracting vectors and indexing text...';

  @override
  String get ingestionCompleted =>
      'Document successfully vectorized into RAG index.';

  @override
  String get shiftSummary => 'Active Shift Summary';

  @override
  String get shiftLead => 'Shift Supervisor';

  @override
  String get assignedCrew => 'Assigned Maintenance Crew';

  @override
  String get scheduledTasks => 'Scheduled Preventative Tasks';

  @override
  String get unscheduledTasks => 'Unscheduled Corrective Tasks';

  @override
  String get checklistVerification => 'Task Verification Checklist';

  @override
  String get signatureRequired => 'Engineer Sign-off Signature';

  @override
  String get signOffButton => 'SUBMIT SHIFT SIGN-OFF';

  @override
  String get taskStatusDueToday => 'DUE TODAY';

  @override
  String get taskStatusOverdue => 'OVERDUE';

  @override
  String get taskStatusInProgress => 'WORK IN PROGRESS';

  @override
  String get taskStatusComplete => 'WORK COMPLETED';

  @override
  String get cameraPreviewTitle => 'INDUSTRIAL EVIDENCE CAPTURE';

  @override
  String get shutterButton => 'Capture Frame';

  @override
  String get flashModeOn => 'Flash: On';

  @override
  String get flashModeOff => 'Flash: Off';

  @override
  String get flashModeAuto => 'Flash: Auto';

  @override
  String get switchCamera => 'Switch Front/Back Camera';

  @override
  String get evidenceType => 'Evidence Category';

  @override
  String get evidenceTypeDefect => 'Component Defect / Wear';

  @override
  String get evidenceTypeRepair => 'Post-Repair Verification';

  @override
  String get evidenceTypeRoutine => 'Routine Visual Inspection';

  @override
  String get evidenceTypeSafety => 'Safety Violation / Hazard';

  @override
  String get attachToActiveChat => 'Send to Active Consultation';

  @override
  String get ok => 'OK';

  @override
  String get apply => 'Apply';

  @override
  String get discard => 'Discard Changes';

  @override
  String get noResultsFound => 'No matching records found';

  @override
  String get refreshing => 'Refreshing telemetry feed...';

  @override
  String get refreshComplete => 'Telemetry synchronized.';

  @override
  String get connectionSecure => 'TLS 1.3 Encrypted Industrial Connection';

  @override
  String get sessionExpired => 'Session expired. Please re-authenticate.';

  @override
  String get developerMode => 'Diagnostic Telemetry Console';

  @override
  String get ballBearing => 'Deep Groove Ball Bearing';

  @override
  String get rollerBearing => 'Cylindrical Roller Bearing';

  @override
  String get sphericalBearing => 'Spherical Roller Bearing';

  @override
  String get thrustBearing => 'Angular Contact Thrust Bearing';

  @override
  String get gridCoupling => 'Tapered Grid Flexible Coupling';

  @override
  String get gearCoupling => 'Double Engagement Gear Coupling';

  @override
  String get discCoupling => 'Metallic Disc Pack Coupling';

  @override
  String get lipSeal => 'Radial Shaft Lip Seal';

  @override
  String get labyrinthSeal => 'Non-contacting Labyrinth Seal';

  @override
  String get glandPacking => 'Graphite Impregnated Gland Packing';

  @override
  String get butterflyValve => 'Wafer Style Butterfly Valve';

  @override
  String get gateValve => 'Cast Steel Wedge Gate Valve';

  @override
  String get ballValve => 'Three-piece Trunnion Ball Valve';

  @override
  String get checkValve => 'Dual Plate Swing Check Valve';

  @override
  String get globeValve => 'Flanged Control Globe Valve';

  @override
  String get reliefValve => 'Direct Spring Loaded Pressure Relief Valve';

  @override
  String get vBelt => 'Heavy Duty Cogged V-Belt';

  @override
  String get timingBelt => 'High Torque Synchronous Timing Belt';

  @override
  String get failureMisalignment => 'Angular & Parallel Shaft Misalignment';

  @override
  String get failureUnbalance => 'Static & Dynamic Rotor Unbalance';

  @override
  String get failureMechanicalLooseness =>
      'Structural / Foundation Mechanical Looseness';

  @override
  String get failureCavitation => 'Suction Recirculation & Blade Cavitation';

  @override
  String get failureThermalGrowth => 'Thermal Expansion Strain on Casing';

  @override
  String get failureLubricationStarvation => 'Boundary Lubrication Breakdown';

  @override
  String get failureFatigueCracking => 'Torsional Cyclic Fatigue Cracking';

  @override
  String get failureFrettingCorrosion =>
      'Fretting Corrosion & False Brinelling';

  @override
  String get failurePitting => 'Gear Tooth Contact Stress Pitting';

  @override
  String get spectrum1X => '1X Running Speed Harmonics';

  @override
  String get spectrum2X => '2X Harmonic Frequency Peak';

  @override
  String get subharmonicVibration => 'Subharmonic Oil Whirl Instability';

  @override
  String get permitHotWork => 'Hot Work Permit (Cutting & Welding)';

  @override
  String get permitColdWork => 'Cold Work Mechanical Maintenance Permit';

  @override
  String get permitConfinedSpace => 'Confined Space Entry Permit (CSEP)';

  @override
  String get permitWorkingAtHeights =>
      'Fall Protection & Working at Heights Permit';

  @override
  String get permitLineBreak => 'Hazardous Piping Line Break Permit';

  @override
  String get permitElectrical => 'Energized Electrical Work Permit (EEWP)';

  @override
  String get permitRadiation => 'Industrial Radiography Safety Permit';

  @override
  String get permitChemical => 'Hazardous Chemical Handling Authorization';

  @override
  String get syncInProgress =>
      'Synchronizing plant data and offline changes...';

  @override
  String get syncSuccess => 'All offline records and attachments synchronized.';

  @override
  String get syncFailed =>
      'Synchronization failed. Cached changes saved locally.';

  @override
  String offlineItemsQueued(int count) {
    return 'Queued for synchronization: $count items';
  }

  @override
  String get conflictsResolved =>
      'Data conflicts resolved automatically with server master.';

  @override
  String get alertCritical => 'CRITICAL ALARM: Immediate shutdown recommended';

  @override
  String get alertWarning => 'PROCESS WARNING: Parameter approaching threshold';

  @override
  String get alertInfo => 'OPERATIONAL NOTE: Routine verification required';

  @override
  String get maintenanceReminder =>
      'Preventative maintenance scheduled within 24 hours';

  @override
  String get calibrationExpired =>
      'Instrument calibration expired. Re-certification required.';

  @override
  String get edit => 'Edit';

  @override
  String get view => 'View';

  @override
  String get download => 'Download';

  @override
  String get share => 'Share';

  @override
  String get copy => 'Copy';

  @override
  String get copiedToClipboard => 'Copied to clipboard';

  @override
  String get filter => 'Filter';

  @override
  String get sort => 'Sort';

  @override
  String get search => 'Search';

  @override
  String get details => 'Details';

  @override
  String get status => 'Status';

  @override
  String get time => 'Time';

  @override
  String get date => 'Date';

  @override
  String get notes => 'Notes';

  @override
  String get summary => 'Summary';

  @override
  String get description => 'Description';

  @override
  String get tags => 'Tags';

  @override
  String get type => 'Type';

  @override
  String get category => 'Category';

  @override
  String get size => 'Size';

  @override
  String get version => 'Version';

  @override
  String get author => 'Author';

  @override
  String get source => 'Source';

  @override
  String get location => 'Plant Location';

  @override
  String get unitArea => 'Process Area / Unit';

  @override
  String get line => 'Production Line';

  @override
  String get station => 'Workstation';

  @override
  String get systemHealth => 'System Health: Nominal';
}
