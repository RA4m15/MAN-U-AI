// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get appTitle => 'MAN-U-AI';

  @override
  String get loginTitle => 'ऑपरेटर लॉगिन';

  @override
  String get loginSubtitle => 'अपने औद्योगिक कोपायलट टर्मिनल में साइन इन करें';

  @override
  String get emailLabel => 'कार्य ईमेल';

  @override
  String get emailHint => 'engineer@plant.com';

  @override
  String get passwordLabel => 'पासवर्ड';

  @override
  String get passwordHint => 'अपना पासवर्ड दर्ज करें';

  @override
  String get signInButton => 'प्रमाणित करें एवं प्रवेश करें';

  @override
  String get registeringTitle => 'नया खाता';

  @override
  String get registerButton => 'खाता पंजीकृत करें';

  @override
  String get fullNameLabel => 'पूरा नाम';

  @override
  String get roleLabel => 'निर्धारित भूमिका';

  @override
  String get roleEngineer =>
      'फील्ड विश्वसनीयता इंजीनियर (Field Reliability Engineer)';

  @override
  String get rolePlantManager =>
      'संयंत्र संचालन प्रबंधक (Plant Operations Manager)';

  @override
  String get roleSupervisor => 'रखरखाव पर्यवेक्षक (Maintenance Supervisor)';

  @override
  String get roleOperator => 'फ्लोर ऑपरेटर (Floor Operator)';

  @override
  String get invalidCredentials => 'अमान्य ईमेल या पासवर्ड।';

  @override
  String get loggingIn => 'प्रमाणीकरण हो रहा है...';

  @override
  String get alreadyHaveAccount => 'पहले से पंजीकृत हैं? साइन इन करें';

  @override
  String get needAccount => 'पहुंच चाहिए? पंजीकरण का अनुरोध करें';

  @override
  String get consultations => 'परामर्श सत्र (CONSULTATIONS)';

  @override
  String get newConsultation => 'नया परामर्श (NEW CONSULTATION)';

  @override
  String get searchSessions => 'सत्र खोजें...';

  @override
  String get todayShiftTasks => 'आज के शिफ्ट कार्य (SHIFT TASKS)';

  @override
  String get floorMaintenance => 'फ्लोर रखरखाव एवं चेकलिस्ट';

  @override
  String get noConsultations => 'कोई सक्रिय परामर्श रिकॉर्ड नहीं मिला';

  @override
  String get activeConsultation => 'सक्रिय';

  @override
  String get settingsTitle => 'सेटिंग्स एवं प्राथमिकताएं';

  @override
  String get signOut => 'साइन आउट करें';

  @override
  String get confirmSignOut => 'क्या आप वाकई साइन आउट करना चाहते हैं?';

  @override
  String get typeMessageHint =>
      'मशीन SOP, मैनुअल, फॉल्ट कोड आदि के बारे में पूछें...';

  @override
  String get sendTooltip => 'संदेश भेजें';

  @override
  String get cameraTooltip => 'फोटो खींचें या वीडियो रिकॉर्ड करें';

  @override
  String get mediaUploadTooltip => 'तकनीकी फोटो या वीडियो अपलोड करें';

  @override
  String get pickEquipmentTooltip => 'संयंत्र उपकरण चुनें';

  @override
  String get plantGlossaryTooltip => 'प्लांट शब्दावली (Glossary)';

  @override
  String get diagramTooltip => 'इंटरैक्टिव एक्सप्लोडेड आरेख';

  @override
  String get deadZoneMode => 'डेड-ज़ोन मोड सक्रिय (ऑफ़लाइन)';

  @override
  String get onlineMode => 'ऑनलाइन // क्लाउड से जुड़ा है';

  @override
  String get reconnectingMode => 'कनेक्शन बहाल // डेटा सिंक्रनाइज़ हो रहा है';

  @override
  String get serverUnavailableMode =>
      'सर्वर अनुपलब्ध // केवल स्थानीय प्रक्रियाएं';

  @override
  String get emptyChatTitle => 'औद्योगिक परामर्श के लिए तैयार';

  @override
  String get emptyChatSubtitle =>
      'उपकरण चुनें या सुरक्षा प्रक्रियाओं, फॉल्ट कोड या रखरखाव चरणों के बारे में पूछें।';

  @override
  String get suggestedPrompt1 => 'Slurry Pump P-102 सील बदलने का SOP समझाएं';

  @override
  String get suggestedPrompt2 =>
      'Conveyor A61 के LOTO आइसोलेशन बिंदु क्या हैं?';

  @override
  String get suggestedPrompt3 =>
      'Centrifugal Pump बेयरिंग पर अत्यधिक कंपन का निदान करें';

  @override
  String get thinkingIndicator =>
      'तकनीकी मैनुअल और टेलीमेट्री का विश्लेषण हो रहा है...';

  @override
  String get citationsTitle => 'दस्तावेज़ स्रोत एवं SOP संदर्भ';

  @override
  String get pageLabel => 'पृष्ठ';

  @override
  String get confidenceLabel => 'विश्वास स्तर';

  @override
  String get safetyNoticeTitle => 'सुरक्षा एवं अनुपालन सूचना';

  @override
  String get safetyNoticeContent =>
      'यांत्रिक डिस्सेम्बली से पहले हमेशा लॉकआउट/टैगआउट (LOTO) प्रोटोकॉल का पालन करें और शून्य ऊर्जा स्थिति सत्यापित करें।';

  @override
  String get cadViewerTitle => '3D मशीन संरचना एक्सप्लोरर';

  @override
  String get sequentialExplodedView => 'क्रमबद्ध एक्सप्लोडेड व्यू';

  @override
  String stageStepLabel(int current, int total) {
    return 'चरण $current / $total';
  }

  @override
  String get previousStage => 'पिछला चरण';

  @override
  String get nextStage => 'अगला चरण';

  @override
  String get resetAssembly => 'असेंबली रीसेट करें';

  @override
  String get continuousSlider => 'निरंतर फैलाव (Explosion Slider)';

  @override
  String get selectedComponent => 'चयनित घटक';

  @override
  String get componentDetails => 'घटक विवरण';

  @override
  String get tapComponentPrompt =>
      'विवरण देखने और AI से पूछने के लिए किसी भी घटक को स्पर्श करें';

  @override
  String get askAiAboutComponent => 'इस घटक के बारे में AI से पूछें';

  @override
  String get isolationSteps => 'आइसोलेशन एवं डिस्सेम्बली चरण';

  @override
  String get loadingCadModel => 'CAD 3D मॉडल लोड हो रहा है...';

  @override
  String get cadModelLoadError => 'CAD मॉडल लोड करने में असमर्थ।';

  @override
  String get evidenceTitle => 'साक्ष्य शीर्षक';

  @override
  String get evidenceTitleHint => 'उदा. Slurry Pump Seal Leakage Inspection';

  @override
  String get observationsTitle => 'निरीक्षण एवं नैदानिक टिप्पणियाँ (वैकल्पिक)';

  @override
  String get observationsHint =>
      'कंपन, अत्यधिक ताप, ध्वनिक असामान्यता या घिसाव दर्ज करें...';

  @override
  String get selectEquipmentDropdown => 'संबंधित उपकरण';

  @override
  String get selectEquipmentPrompt => 'उपकरण इकाई चुनें...';

  @override
  String get addPhotos => 'फोटो जोड़ें';

  @override
  String get addVideos => 'वीडियो जोड़ें';

  @override
  String get uploadEvidence => 'साक्ष्य अपलोड करें';

  @override
  String get uploadingMedia => 'मीडिया साक्ष्य अपलोड हो रहा है...';

  @override
  String get uploadSuccess => 'मीडिया सफलतापूर्वक अपलोड और लिंक किया गया!';

  @override
  String get uploadFailed => 'मीडिया अपलोड विफल। कृपया पुनः प्रयास करें।';

  @override
  String get takePhotoOption => 'फोटो लें';

  @override
  String get recordVideoOption => 'वीडियो रिकॉर्ड करें';

  @override
  String get galleryOption => 'गैलरी से चुनें';

  @override
  String get equipmentDetailsTitle => 'उपकरण विनिर्देश';

  @override
  String get equipmentStatusNormal => 'सामान्य';

  @override
  String get equipmentStatusWarning => 'चेतावनी';

  @override
  String get equipmentStatusCritical => 'गंभीर';

  @override
  String get operatingTemperature => 'ऑपरेटिंग तापमान';

  @override
  String get pressureReadout => 'ऑपरेटिंग दबाव';

  @override
  String get vibrationLevel => 'कंपन स्तर';

  @override
  String get motorSpeed => 'मोटर गति (RPM)';

  @override
  String get lastMaintenance => 'अंतिम रखरखाव';

  @override
  String get nextScheduled => 'अगला निर्धारित निरीक्षण';

  @override
  String get downloadAreaPack => 'ऑफ़लाइन एरिया पैक डाउनलोड करें';

  @override
  String get areaPackDownloaded =>
      'ऑफ़लाइन उपयोग के लिए एरिया पैक संग्रहीत है।';

  @override
  String get shiftTasksTitle => 'शिफ्ट रखरखाव कार्य';

  @override
  String get priorityHigh => 'उच्च प्राथमिकता';

  @override
  String get priorityMedium => 'मध्यम';

  @override
  String get priorityLow => 'कम';

  @override
  String get markAsCompleted => 'पूर्ण चिह्नित करें';

  @override
  String get completedStatus => 'पूर्ण';

  @override
  String get pendingStatus => 'लंबित';

  @override
  String get noTasksToday =>
      'इस शिफ्ट के लिए कोई रखरखाव कार्य निर्धारित नहीं है।';

  @override
  String get documentsTitle => 'तकनीकी दस्तावेज़ एवं SOPs';

  @override
  String get manualsTab => 'मैनुअल (Manuals)';

  @override
  String get sopsTab => 'SOPs';

  @override
  String get schematicsTab => 'आरेख (Schematics)';

  @override
  String get searchDocumentsHint => 'दस्तावेज़ एवं मैनुअल खोजें...';

  @override
  String get ingestionStatus => 'इंजेशन स्थिति';

  @override
  String get indexedPages => 'इंडेक्स किए गए पृष्ठ';

  @override
  String get uploadDocumentPrompt => 'मैनुअल / PDF अपलोड करें';

  @override
  String get settingsHeader => 'सेटिंग्स';

  @override
  String get appearanceSection => 'दिखावट (APPEARANCE)';

  @override
  String get lightMode => 'लाइट मोड (Light)';

  @override
  String get lightModeDescription => 'स्पष्ट उच्च-विपरीत तकनीकी लाइट इंटरफेस';

  @override
  String get darkMode => 'डार्क मोड (Dark)';

  @override
  String get darkModeDescription => 'औद्योगिक कम-चमक डार्क कार्यक्षेत्र';

  @override
  String get systemDefault => 'सिस्टम डिफ़ॉल्ट (System)';

  @override
  String get systemDefaultDescription => 'ऑपरेटिंग सिस्टम की दिखावट के अनुसार';

  @override
  String get languageSection => 'भाषा (LANGUAGE)';

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
  String get userAccountSection => 'उपयोगकर्ता खाता';

  @override
  String get activeRole => 'सक्रिय भूमिका';

  @override
  String get sessionToken => 'सत्र';

  @override
  String get activeSession => 'प्रमाणित';

  @override
  String get appInfoSection => 'अनुप्रयोग जानकारी';

  @override
  String get appVersion => 'संस्करण 2.4.0 (बिल्ड 2026.11)';

  @override
  String get offlineCacheTitle => 'ऑफ़लाइन भंडारण एवं एरिया पैक';

  @override
  String get clearCacheButton => 'ऑफ़लाइन कैश साफ़ करें';

  @override
  String get cacheClearedNotice => 'ऑफ़लाइन कैश सफलतापूर्वक साफ़ किया गया।';

  @override
  String get cancel => 'रद्द करें';

  @override
  String get save => 'सहेजें';

  @override
  String get confirm => 'पुष्टि करें';

  @override
  String get close => 'बंद करें';

  @override
  String get delete => 'हटाएं';

  @override
  String get retry => 'पुनः प्रयास करें';

  @override
  String get errorTitle => 'त्रुटि';

  @override
  String get genericError => 'एक अनपेक्षित त्रुटि हुई। कृपया पुनः प्रयास करें।';

  @override
  String get networkError =>
      'नेटवर्क कनेक्शन अनुपलब्ध। ऑफ़लाइन मोड में काम कर रहे हैं।';

  @override
  String get offlineWarning =>
      'डेड ज़ोन का पता चला: AI सुविधाएं कैश्ड मैनुअल का उपयोग करेंगी।';

  @override
  String get slurryPumpTitle =>
      'सेंट्रीफ्यूगल स्लरी पंप P-102 (Centrifugal Slurry Pump)';

  @override
  String get conveyorBeltTitle =>
      'ओवरलैंड कन्वेयर बेल्ट A61 (Overland Conveyor Belt)';

  @override
  String get hydraulicPressTitle =>
      'हाइड्रोलिक स्टैम्पिंग प्रेस H-400 (Hydraulic Press)';

  @override
  String get compressorUnitTitle =>
      'रोटरी स्क्रू कंप्रेसर C-12 (Screw Compressor)';

  @override
  String get heatExchangerTitle =>
      'शेल एवं ट्यूब हीट एक्सचेंजर E-301 (Heat Exchanger)';

  @override
  String get industrialFanTitle =>
      'आईडी ड्राफ्ट एग्जॉस्ट फैन F-505 (Exhaust Fan)';

  @override
  String get equipmentStatus => 'उपकरण स्थिति';

  @override
  String get operationalState => 'सक्रिय संचालन (OPERATIONAL)';

  @override
  String get degradedState => 'ह्रासमान (DEGRADED)';

  @override
  String get trippedState => 'ट्रिप्ड (TRIPPED)';

  @override
  String get offlineState => 'ऑफ़लाइन (OFFLINE)';

  @override
  String get maintenanceDue => 'रखरखाव देय (MAINTENANCE DUE)';

  @override
  String get assetTag => 'एसेट टैग';

  @override
  String get serialNumber => 'सीरियल नंबर';

  @override
  String get manufacturer => 'निर्माता (OEM)';

  @override
  String get modelYear => 'मॉडल वर्ष';

  @override
  String get ratedCapacity => 'रेटेड क्षमता';

  @override
  String get operatingHours => 'संचालन घंटे (Run Hours)';

  @override
  String get telemetryHeader => 'रीयल-टाइम टेलीमेट्री मापदंड';

  @override
  String get bearingVibration => 'बेयरिंग कंपन (Vibration)';

  @override
  String get casingVibration => 'केसिंग कंपन';

  @override
  String get suctionPressure => 'सक्शन दबाव (Suction Pressure)';

  @override
  String get dischargePressure => 'डिस्चार्ज दबाव (Discharge Pressure)';

  @override
  String get windingTemperature => 'मोटर वाइंडिंग तापमान';

  @override
  String get oilTemperature => 'ल्यूब ऑयल तापमान';

  @override
  String get bearingTemperature => 'ड्राइव बेयरिंग तापमान';

  @override
  String get flowRate => 'वॉल्यूमेट्रिक प्रवाह दर (Flow Rate)';

  @override
  String get powerConsumption => 'वर्तमान बिजली खपत';

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
  String get unitHours => 'घंटे';

  @override
  String get lotoProtocolTitle => 'लॉकआउट / टैगआउट (LOTO) कार्यविधि';

  @override
  String get lotoStep1 =>
      '1. उपकरण बंद होने की सूचना संबंधित कर्मचारियों को दें।';

  @override
  String get lotoStep2 =>
      '2. स्थानीय कंट्रोल पैनल से नियंत्रित शटडाउन निष्पादित करें।';

  @override
  String get lotoStep3 =>
      '3. MCC-02 पर मुख्य 480V सर्किट ब्रेकर को अलग (isolate) करें।';

  @override
  String get lotoStep4 => '4. व्यक्तिगत सुरक्षा पैडलॉक और डेंजर टैग लगाएं।';

  @override
  String get lotoStep5 =>
      '5. हाइड्रोलिक और न्यूमेटिक लाइनों का दबाव शून्य करें।';

  @override
  String get lotoStep6 =>
      '6. कैलिब्रेटेड मल्टीमीटर का उपयोग करके शून्य ऊर्जा स्थिति सत्यापित करें।';

  @override
  String get zeroEnergyVerified =>
      'शून्य ऊर्जा स्थिति सत्यापित (Zero Energy Verified)';

  @override
  String get ppeRequiredTitle => 'अनिवार्य व्यक्तिगत सुरक्षा उपकरण (PPE)';

  @override
  String get ppeHardHat => 'सुरक्षा हेलमेट (ANSI Z89.1)';

  @override
  String get ppeSafetyGlasses => 'साइड शील्ड्स सहित सुरक्षा चश्मा';

  @override
  String get ppeEarProtection => 'श्रवण सुरक्षा (Hearing Protection 28+ dB)';

  @override
  String get ppeSteelToeBoots => 'स्टील टो सुरक्षा जूते';

  @override
  String get ppeHeatResistantGloves => 'हैवी ड्यूटी यांत्रिक दस्ताने';

  @override
  String get hazardArcFlash => 'खतरा: आर्क फ्लैश एवं विद्युत झटका जोखिम';

  @override
  String get hazardHighPressure => 'चेतावनी: उच्च दबाव द्रव इंजेक्शन जोखिम';

  @override
  String get hazardRotatingMachinery => 'सावधानी: घूमती हुई यांत्रिक शाफ्ट';

  @override
  String get hazardHotSurfaces => 'सावधानी: 70°C से अधिक गर्म सतहें';

  @override
  String get emergencyStopTriggered => 'इमरजेंसी स्टॉप (E-STOP) सक्रिय';

  @override
  String get permitToWorkRequired =>
      'प्रवेश से पूर्व सुरक्षित कार्य परमिट (SWP) अनिवार्य';

  @override
  String get impellerComponent => 'क्लोज्ड श्राउडेड इम्पेलर (Impeller)';

  @override
  String get mechanicalSealComponent =>
      'कार्ट्रिज मैकेनिकल सील (Mechanical Seal)';

  @override
  String get shaftComponent => 'फोर्ज्ड एलॉय ड्राइव शाफ्ट (Shaft)';

  @override
  String get suctionCoverComponent => 'सक्शन लाइनर प्लेट';

  @override
  String get voluteCasingComponent =>
      'हैवी ड्यूटी वोल्यूट केसिंग (Volute Casing)';

  @override
  String get bearingHousingComponent => 'ग्रीस लुब्रिकेटेड बेयरिंग हाउसिंग';

  @override
  String get wearRingComponent =>
      'बदली जाने योग्य कांस्य वियर रिंग (Wear Ring)';

  @override
  String get stuffingBoxComponent => 'हाई प्रेशर स्टफिंग बॉक्स';

  @override
  String get lanternRingComponent => 'PTFE फ्लश लालटेन रिंग';

  @override
  String get couplingComponent => 'फ्लेक्सिबल जॉ कपलिंग (Jaw Coupling)';

  @override
  String get gasketComponent => 'सर्पिल घाव धातु गैसकेट (Spiral Wound Gasket)';

  @override
  String get oRingComponent => 'फ्लोरोइलास्टोमर ओ-रिंग सील (O-Ring)';

  @override
  String get componentTorqueSpecs => 'बोल्ट टॉर्क विनिर्देश (Torque Specs)';

  @override
  String get torqueNm => 'N·m';

  @override
  String get torqueFootPounds => 'ft-lb';

  @override
  String get assemblyOverview => 'असेंबली पदानुक्रम एवं उप-घटक';

  @override
  String get disassemblySequence => 'सुरक्षित डिस्सेम्बली क्रम';

  @override
  String get reassemblySequence => 'मानक पुनः असेंबली क्रम';

  @override
  String get inspectionTolerances =>
      'क्लीयरेंस एवं रनआउट सहनशीलता (Tolerances)';

  @override
  String get diagnosticsTitle => 'निर्देशित औद्योगिक खराबी निदान (Diagnostics)';

  @override
  String get symptomSelectorTitle => 'देखे गए लक्षण का चयन करें';

  @override
  String get symptomHighVibration => '4.5 mm/s से अधिक असामान्य कंपन';

  @override
  String get symptomExcessiveHeat => 'बेयरिंग तापमान चेतावनी (>85°C)';

  @override
  String get symptomCavitation =>
      'केविटेशन ध्वनि (केसिंग में कंकड़ बजने जैसी आवाज)';

  @override
  String get symptomLowFlow => 'परिचालन वक्र से नीचे डिस्चार्ज प्रवाह दर';

  @override
  String get symptomSealLeakage => 'मैकेनिकल सील ग्लैंड से द्रव रिसाव';

  @override
  String get symptomMotorOverload => 'मोटर थर्मल ओवरलोड ट्रिप';

  @override
  String get rootCauseAnalysis => 'संभावित मूल कारण (Root Causes)';

  @override
  String get recommendedAction => 'अनुशंसित सुधारात्मक कार्रवाई';

  @override
  String get estimatedRepairTime => 'अनुमानित डाउनटाइम / मरम्मत समय';

  @override
  String get toolsRequiredTitle => 'आवश्यक विशेष उपकरण';

  @override
  String get replacementPartsTitle => 'अनुशंसित स्पेयर पार्ट्स';

  @override
  String get searchSopHint => 'SOP, आरेख या उपकरण कोड खोजें...';

  @override
  String get filterAll => 'सभी दस्तावेज़';

  @override
  String get filterManuals => 'OEM मैनुअल';

  @override
  String get filterSops => 'रखरखाव SOPs';

  @override
  String get filterElectrical => 'विद्युत एवं सिंगल लाइन डायग्राम';

  @override
  String get filterPid => 'P&ID फ्लो आरेख';

  @override
  String get documentSize => 'फ़ाइल आकार';

  @override
  String get documentPages => 'कुल पृष्ठ';

  @override
  String get documentUploaded => 'अपलोड तिथि';

  @override
  String get documentVerified => 'इंजीनियरिंग सत्यापित';

  @override
  String get downloadPdf => 'तकनीकी PDF डाउनलोड करें';

  @override
  String get openDocument => 'व्यूअर में दस्तावेज़ खोलें';

  @override
  String get uploadSopDocument => 'नया इंजीनियरिंग SOP लोड करें';

  @override
  String get ingestionProgress =>
      'वेक्टर निष्कर्षण एवं टेक्स्ट इंडेक्सिंग जारी...';

  @override
  String get ingestionCompleted =>
      'दस्तावेज़ सफलतापूर्वक RAG इंडेक्स में शामिल।';

  @override
  String get shiftSummary => 'सक्रिय शिफ्ट सारांश';

  @override
  String get shiftLead => 'शिफ्ट पर्यवेक्षक (Supervisor)';

  @override
  String get assignedCrew => 'निर्धारित रखरखाव दल';

  @override
  String get scheduledTasks => 'निर्धारित निवारक कार्य';

  @override
  String get unscheduledTasks => 'अनिर्धारित सुधारात्मक कार्य';

  @override
  String get checklistVerification => 'कार्य सत्यापन चेकलिस्ट';

  @override
  String get signatureRequired => 'इंजीनियर हस्ताक्षर एवं अनुमोदन';

  @override
  String get signOffButton => 'शिफ्ट साइन-ऑफ सबमिट करें';

  @override
  String get taskStatusDueToday => 'आज देय (DUE TODAY)';

  @override
  String get taskStatusOverdue => 'अतिदेय (OVERDUE)';

  @override
  String get taskStatusInProgress => 'प्रगति पर (IN PROGRESS)';

  @override
  String get taskStatusComplete => 'पूर्ण (COMPLETED)';

  @override
  String get cameraPreviewTitle => 'औद्योगिक साक्ष्य कैप्चर';

  @override
  String get shutterButton => 'फ़्रेम कैप्चर करें';

  @override
  String get flashModeOn => 'फ्लैश: चालू';

  @override
  String get flashModeOff => 'फ्लैश: बंद';

  @override
  String get flashModeAuto => 'फ्लैश: स्वतः';

  @override
  String get switchCamera => 'कैमरा बदलें (आगे/पीछे)';

  @override
  String get evidenceType => 'साक्ष्य श्रेणी';

  @override
  String get evidenceTypeDefect => 'घटक खराबी / घिसाव';

  @override
  String get evidenceTypeRepair => 'मरम्मत उपरांत सत्यापन';

  @override
  String get evidenceTypeRoutine => 'नियमित दृश्य निरीक्षण';

  @override
  String get evidenceTypeSafety => 'सुरक्षा उल्लंघन / खतरा';

  @override
  String get attachToActiveChat => 'सक्रिय परामर्श में भेजें';

  @override
  String get ok => 'ठीक है (OK)';

  @override
  String get apply => 'लागू करें';

  @override
  String get discard => 'परिवर्तन त्यागें';

  @override
  String get noResultsFound => 'कोई मेल खाते रिकॉर्ड नहीं मिले';

  @override
  String get refreshing => 'टेलीमेट्री डेटा ताज़ा हो रहा है...';

  @override
  String get refreshComplete => 'टेलीमेट्री सिंक्रनाइज़ हो गई।';

  @override
  String get connectionSecure => 'TLS 1.3 एन्क्रिप्टेड सुरक्षित कनेक्शन';

  @override
  String get sessionExpired => 'सत्र समाप्त हो गया। कृपया पुनः लॉग इन करें।';

  @override
  String get developerMode => 'डायग्नोस्टिक टेलीमेट्री कंसोल';

  @override
  String get ballBearing => 'डीप ग्रूव बॉल बेयरिंग (Ball Bearing)';

  @override
  String get rollerBearing => 'सिलिंड्रिकल रोलर बेयरिंग (Roller Bearing)';

  @override
  String get sphericalBearing => 'स्फेरिकल रोलर बेयरिंग (Spherical Bearing)';

  @override
  String get thrustBearing =>
      'एंगुलर कॉन्टैक्ट थ्रस्ट बेयरिंग (Thrust Bearing)';

  @override
  String get gridCoupling => 'टेपर्ड ग्रिड फ्लेक्सिबल कपलिंग (Grid Coupling)';

  @override
  String get gearCoupling => 'डबल एंगेजमेंट गियर कपलिंग (Gear Coupling)';

  @override
  String get discCoupling => 'मेटैलिक डिस्क पैक कपलिंग (Disc Coupling)';

  @override
  String get lipSeal => 'रेडियल शाफ्ट लिप सील (Lip Seal)';

  @override
  String get labyrinthSeal => 'नॉन-कॉन्टैक्टिंग लेबिरिंथ सील (Labyrinth Seal)';

  @override
  String get glandPacking =>
      'ग्रेफाइट इम्प्रैग्नेटेड ग्लैंड पैकिंग (Gland Packing)';

  @override
  String get butterflyValve => 'वेफर स्टाइल बटरफ्लाई वाल्व (Butterfly Valve)';

  @override
  String get gateValve => 'कास्ट स्टील वेज गेट वाल्व (Gate Valve)';

  @override
  String get ballValve => 'थ्री-पीस ट्रूनियन बॉल वाल्व (Ball Valve)';

  @override
  String get checkValve => 'ड्यूल प्लेट स्विंग चेक वाल्व (Check Valve)';

  @override
  String get globeValve => 'फ्लैंग्ड कंट्रोल ग्लोब वाल्व (Globe Valve)';

  @override
  String get reliefValve =>
      'डायरेक्ट स्प्रिंग लोडेड प्रेशर रिलीफ वाल्व (Relief Valve)';

  @override
  String get vBelt => 'हैवी ड्यूटी कॉग्ड वी-बेल्ट (V-Belt)';

  @override
  String get timingBelt => 'हाई टॉर्क सिंक्रोनस टाइमिंग बेल्ट (Timing Belt)';

  @override
  String get failureMisalignment =>
      'कोणीय एवं समानांतर शाफ्ट मिसअलाइनमेंट (Misalignment)';

  @override
  String get failureUnbalance =>
      'स्टैटिक एवं डायनामिक रोटर असंतुलन (Unbalance)';

  @override
  String get failureMechanicalLooseness =>
      'संरचनात्मक यांत्रिक ढीलापन (Mechanical Looseness)';

  @override
  String get failureCavitation =>
      'सक्शन पुनर्संचरण एवं ब्लेड कैविटेशन (Cavitation)';

  @override
  String get failureThermalGrowth =>
      'केसिंग पर तापीय विस्तार तनाव (Thermal Growth)';

  @override
  String get failureLubricationStarvation =>
      'स्नेहन विफलता (Lubrication Breakdown)';

  @override
  String get failureFatigueCracking =>
      'टॉर्शनल चक्रीय थकान दरारें (Fatigue Cracking)';

  @override
  String get failureFrettingCorrosion => 'फ्रेटिंग जंग (Fretting Corrosion)';

  @override
  String get failurePitting => 'गियर दांत संपर्क पिटिंग (Contact Pitting)';

  @override
  String get spectrum1X => '1X रनिंग स्पीड हार्मोनिक्स';

  @override
  String get spectrum2X => '2X हार्मोनिक फ्रीक्वेंसी पीक';

  @override
  String get subharmonicVibration => 'सब-हार्मोनिक ऑयल व्हर्ल अस्थिरता';

  @override
  String get permitHotWork => 'हॉट वर्क परमिट (कटिंग एवं वेल्डिंग)';

  @override
  String get permitColdWork => 'कोल्ड वर्क मैकेनिकल मेंटेनेंस परमिट';

  @override
  String get permitConfinedSpace => 'सीमित स्थान प्रवेश परमिट (CSEP)';

  @override
  String get permitWorkingAtHeights => 'ऊंचाई पर कार्य सुरक्षा परमिट';

  @override
  String get permitLineBreak => 'खतरनाक पाइपिंग लाइन ब्रेक परमिट';

  @override
  String get permitElectrical => 'विद्युत कार्य परमिट (EEWP)';

  @override
  String get permitRadiation => 'औद्योगिक रेडियोग्राफी सुरक्षा परमिट';

  @override
  String get permitChemical => 'खतरनाक रसायन हैंडलिंग प्राधिकरण';

  @override
  String get syncInProgress =>
      'प्लांट डेटा एवं ऑफ़लाइन परिवर्तन सिंक्रनाइज़ हो रहे हैं...';

  @override
  String get syncSuccess => 'सभी ऑफ़लाइन रिकॉर्ड और संलग्नक सिंक्रनाइज़ हो गए।';

  @override
  String get syncFailed =>
      'सिंक्रनाइज़ेशन विफल। कैश्ड परिवर्तन स्थानीय रूप से सहेजे गए।';

  @override
  String offlineItemsQueued(int count) {
    return 'सिंक्रनाइज़ेशन के लिए कतारबद्ध: $count आइटम';
  }

  @override
  String get conflictsResolved =>
      'डेटा विरोध सर्वर मास्टर के साथ स्वचालित रूप से हल हो गए।';

  @override
  String get alertCritical => 'गंभीर अलार्म: तत्काल शटडाउन की सिफारिश';

  @override
  String get alertWarning => 'प्रक्रिया चेतावनी: पैरामीटर सीमा के करीब है';

  @override
  String get alertInfo => 'परिचालन नोट: नियमित सत्यापन आवश्यक';

  @override
  String get maintenanceReminder => '24 घंटे के भीतर निवारक रखरखाव निर्धारित';

  @override
  String get calibrationExpired => 'उपकरण अंशांकन समाप्त। पुन: प्रमाणन आवश्यक।';

  @override
  String get edit => 'संपादित करें (Edit)';

  @override
  String get view => 'देखें (View)';

  @override
  String get download => 'डाउनलोड करें (Download)';

  @override
  String get share => 'साझा करें (Share)';

  @override
  String get copy => 'कॉपी करें (Copy)';

  @override
  String get copiedToClipboard => 'क्लिपबोर्ड पर कॉपी किया गया';

  @override
  String get filter => 'फ़िल्टर (Filter)';

  @override
  String get sort => 'क्रमबद्ध करें (Sort)';

  @override
  String get search => 'खोजें (Search)';

  @override
  String get details => 'विवरण (Details)';

  @override
  String get status => 'स्थिति (Status)';

  @override
  String get time => 'समय';

  @override
  String get date => 'दिनांक';

  @override
  String get notes => 'टिप्पणियां (Notes)';

  @override
  String get summary => 'सारांश (Summary)';

  @override
  String get description => 'विवरण (Description)';

  @override
  String get tags => 'टैग (Tags)';

  @override
  String get type => 'प्रकार (Type)';

  @override
  String get category => 'श्रेणी (Category)';

  @override
  String get size => 'आकार (Size)';

  @override
  String get version => 'संस्करण (Version)';

  @override
  String get author => 'लेखक (Author)';

  @override
  String get source => 'स्रोत (Source)';

  @override
  String get location => 'संयंत्र स्थान (Plant Location)';

  @override
  String get unitArea => 'प्रक्रिया क्षेत्र (Process Area)';

  @override
  String get line => 'उत्पादन लाइन (Line)';

  @override
  String get station => 'कार्य केंद्र (Workstation)';

  @override
  String get systemHealth => 'सिस्टम स्वास्थ्य: सामान्य (Nominal)';
}
