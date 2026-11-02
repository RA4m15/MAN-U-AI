import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
  ];

  /// Application title
  ///
  /// In en, this message translates to:
  /// **'MAN-U-AI'**
  String get appTitle;

  /// No description provided for @loginTitle.
  ///
  /// In en, this message translates to:
  /// **'OPERATOR LOGIN'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to your industrial copilot terminal'**
  String get loginSubtitle;

  /// No description provided for @emailLabel.
  ///
  /// In en, this message translates to:
  /// **'WORK EMAIL'**
  String get emailLabel;

  /// No description provided for @emailHint.
  ///
  /// In en, this message translates to:
  /// **'engineer@plant.com'**
  String get emailHint;

  /// No description provided for @passwordLabel.
  ///
  /// In en, this message translates to:
  /// **'PASSWORD'**
  String get passwordLabel;

  /// No description provided for @passwordHint.
  ///
  /// In en, this message translates to:
  /// **'Enter your password'**
  String get passwordHint;

  /// No description provided for @signInButton.
  ///
  /// In en, this message translates to:
  /// **'AUTHENTICATE & ENTER'**
  String get signInButton;

  /// No description provided for @registeringTitle.
  ///
  /// In en, this message translates to:
  /// **'NEW ACCOUNT'**
  String get registeringTitle;

  /// No description provided for @registerButton.
  ///
  /// In en, this message translates to:
  /// **'REGISTER ACCOUNT'**
  String get registerButton;

  /// No description provided for @fullNameLabel.
  ///
  /// In en, this message translates to:
  /// **'FULL NAME'**
  String get fullNameLabel;

  /// No description provided for @roleLabel.
  ///
  /// In en, this message translates to:
  /// **'ASSIGNED ROLE'**
  String get roleLabel;

  /// No description provided for @roleEngineer.
  ///
  /// In en, this message translates to:
  /// **'Field Reliability Engineer'**
  String get roleEngineer;

  /// No description provided for @rolePlantManager.
  ///
  /// In en, this message translates to:
  /// **'Plant Operations Manager'**
  String get rolePlantManager;

  /// No description provided for @roleSupervisor.
  ///
  /// In en, this message translates to:
  /// **'Maintenance Supervisor'**
  String get roleSupervisor;

  /// No description provided for @roleOperator.
  ///
  /// In en, this message translates to:
  /// **'Floor Operator'**
  String get roleOperator;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid email or password.'**
  String get invalidCredentials;

  /// No description provided for @loggingIn.
  ///
  /// In en, this message translates to:
  /// **'Authenticating...'**
  String get loggingIn;

  /// No description provided for @alreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already registered? Sign in'**
  String get alreadyHaveAccount;

  /// No description provided for @needAccount.
  ///
  /// In en, this message translates to:
  /// **'Need access? Request registration'**
  String get needAccount;

  /// No description provided for @consultations.
  ///
  /// In en, this message translates to:
  /// **'CONSULTATION SESSIONS'**
  String get consultations;

  /// No description provided for @newConsultation.
  ///
  /// In en, this message translates to:
  /// **'NEW CONSULTATION'**
  String get newConsultation;

  /// No description provided for @searchSessions.
  ///
  /// In en, this message translates to:
  /// **'Search sessions...'**
  String get searchSessions;

  /// No description provided for @todayShiftTasks.
  ///
  /// In en, this message translates to:
  /// **'TODAY\'S SHIFT TASKS'**
  String get todayShiftTasks;

  /// No description provided for @floorMaintenance.
  ///
  /// In en, this message translates to:
  /// **'Floor maintenance & checklist'**
  String get floorMaintenance;

  /// No description provided for @noConsultations.
  ///
  /// In en, this message translates to:
  /// **'No active consultation records found'**
  String get noConsultations;

  /// No description provided for @activeConsultation.
  ///
  /// In en, this message translates to:
  /// **'ACTIVE'**
  String get activeConsultation;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'SETTINGS & PREFERENCES'**
  String get settingsTitle;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @confirmSignOut.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to sign out?'**
  String get confirmSignOut;

  /// No description provided for @typeMessageHint.
  ///
  /// In en, this message translates to:
  /// **'Ask MAN-U-AI about machine SOPs, manuals, fault codes...'**
  String get typeMessageHint;

  /// No description provided for @sendTooltip.
  ///
  /// In en, this message translates to:
  /// **'Send message'**
  String get sendTooltip;

  /// No description provided for @cameraTooltip.
  ///
  /// In en, this message translates to:
  /// **'Take photo or record video'**
  String get cameraTooltip;

  /// No description provided for @mediaUploadTooltip.
  ///
  /// In en, this message translates to:
  /// **'Upload technical photos or videos'**
  String get mediaUploadTooltip;

  /// No description provided for @pickEquipmentTooltip.
  ///
  /// In en, this message translates to:
  /// **'Select plant equipment'**
  String get pickEquipmentTooltip;

  /// No description provided for @plantGlossaryTooltip.
  ///
  /// In en, this message translates to:
  /// **'Plant Glossary & Slang'**
  String get plantGlossaryTooltip;

  /// No description provided for @diagramTooltip.
  ///
  /// In en, this message translates to:
  /// **'Interactive Exploded Diagram'**
  String get diagramTooltip;

  /// No description provided for @deadZoneMode.
  ///
  /// In en, this message translates to:
  /// **'Dead-Zone Mode Active'**
  String get deadZoneMode;

  /// No description provided for @onlineMode.
  ///
  /// In en, this message translates to:
  /// **'Online // Connected to MAN-U-AI Cloud'**
  String get onlineMode;

  /// No description provided for @reconnectingMode.
  ///
  /// In en, this message translates to:
  /// **'Connection Restored // Synchronizing Data'**
  String get reconnectingMode;

  /// No description provided for @serverUnavailableMode.
  ///
  /// In en, this message translates to:
  /// **'Server Unavailable // Local Procedures Only'**
  String get serverUnavailableMode;

  /// No description provided for @emptyChatTitle.
  ///
  /// In en, this message translates to:
  /// **'READY FOR INDUSTRIAL CONSULTATION'**
  String get emptyChatTitle;

  /// No description provided for @emptyChatSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Select an equipment unit or ask about safety procedures, fault codes, or maintenance steps.'**
  String get emptyChatSubtitle;

  /// No description provided for @suggestedPrompt1.
  ///
  /// In en, this message translates to:
  /// **'Explain SOP for Slurry Pump P-102 seal replacement'**
  String get suggestedPrompt1;

  /// No description provided for @suggestedPrompt2.
  ///
  /// In en, this message translates to:
  /// **'What are the LOTO isolation points for Conveyor A61?'**
  String get suggestedPrompt2;

  /// No description provided for @suggestedPrompt3.
  ///
  /// In en, this message translates to:
  /// **'Diagnose high vibration on Centrifugal Pump bearing'**
  String get suggestedPrompt3;

  /// No description provided for @thinkingIndicator.
  ///
  /// In en, this message translates to:
  /// **'Analyzing technical manuals and telemetry...'**
  String get thinkingIndicator;

  /// No description provided for @citationsTitle.
  ///
  /// In en, this message translates to:
  /// **'DOCUMENT SOURCES & SOP CITATIONS'**
  String get citationsTitle;

  /// No description provided for @pageLabel.
  ///
  /// In en, this message translates to:
  /// **'Page'**
  String get pageLabel;

  /// No description provided for @confidenceLabel.
  ///
  /// In en, this message translates to:
  /// **'Confidence'**
  String get confidenceLabel;

  /// No description provided for @safetyNoticeTitle.
  ///
  /// In en, this message translates to:
  /// **'SAFETY & COMPLIANCE NOTICE'**
  String get safetyNoticeTitle;

  /// No description provided for @safetyNoticeContent.
  ///
  /// In en, this message translates to:
  /// **'Always follow Lockout/Tagout (LOTO) protocols and verify zero energy state before mechanical disassembly.'**
  String get safetyNoticeContent;

  /// No description provided for @cadViewerTitle.
  ///
  /// In en, this message translates to:
  /// **'3D Machine Structure Explorer'**
  String get cadViewerTitle;

  /// No description provided for @sequentialExplodedView.
  ///
  /// In en, this message translates to:
  /// **'Sequential Exploded View'**
  String get sequentialExplodedView;

  /// Stage progress indicator
  ///
  /// In en, this message translates to:
  /// **'Stage {current} of {total}'**
  String stageStepLabel(int current, int total);

  /// No description provided for @previousStage.
  ///
  /// In en, this message translates to:
  /// **'Previous Stage'**
  String get previousStage;

  /// No description provided for @nextStage.
  ///
  /// In en, this message translates to:
  /// **'Next Stage'**
  String get nextStage;

  /// No description provided for @resetAssembly.
  ///
  /// In en, this message translates to:
  /// **'Reset Assembly'**
  String get resetAssembly;

  /// No description provided for @continuousSlider.
  ///
  /// In en, this message translates to:
  /// **'Continuous Explosion'**
  String get continuousSlider;

  /// No description provided for @selectedComponent.
  ///
  /// In en, this message translates to:
  /// **'Selected Component'**
  String get selectedComponent;

  /// No description provided for @componentDetails.
  ///
  /// In en, this message translates to:
  /// **'Component Details'**
  String get componentDetails;

  /// No description provided for @tapComponentPrompt.
  ///
  /// In en, this message translates to:
  /// **'Tap any component to inspect details and ask AI'**
  String get tapComponentPrompt;

  /// No description provided for @askAiAboutComponent.
  ///
  /// In en, this message translates to:
  /// **'Ask AI about this component'**
  String get askAiAboutComponent;

  /// No description provided for @isolationSteps.
  ///
  /// In en, this message translates to:
  /// **'Isolation & Disassembly Steps'**
  String get isolationSteps;

  /// No description provided for @loadingCadModel.
  ///
  /// In en, this message translates to:
  /// **'Loading CAD 3D Model...'**
  String get loadingCadModel;

  /// No description provided for @cadModelLoadError.
  ///
  /// In en, this message translates to:
  /// **'Unable to load CAD model.'**
  String get cadModelLoadError;

  /// No description provided for @evidenceTitle.
  ///
  /// In en, this message translates to:
  /// **'EVIDENCE TITLE'**
  String get evidenceTitle;

  /// No description provided for @evidenceTitleHint.
  ///
  /// In en, this message translates to:
  /// **'e.g. Slurry Pump Seal Leakage Inspection'**
  String get evidenceTitleHint;

  /// No description provided for @observationsTitle.
  ///
  /// In en, this message translates to:
  /// **'OBSERVATIONS & DIAGNOSTIC NOTES (OPTIONAL)'**
  String get observationsTitle;

  /// No description provided for @observationsHint.
  ///
  /// In en, this message translates to:
  /// **'Note vibration, overheating, acoustic anomalies, or part wear...'**
  String get observationsHint;

  /// No description provided for @selectEquipmentDropdown.
  ///
  /// In en, this message translates to:
  /// **'ASSOCIATED EQUIPMENT'**
  String get selectEquipmentDropdown;

  /// No description provided for @selectEquipmentPrompt.
  ///
  /// In en, this message translates to:
  /// **'Select equipment unit...'**
  String get selectEquipmentPrompt;

  /// No description provided for @addPhotos.
  ///
  /// In en, this message translates to:
  /// **'ADD PHOTOS'**
  String get addPhotos;

  /// No description provided for @addVideos.
  ///
  /// In en, this message translates to:
  /// **'ADD VIDEOS'**
  String get addVideos;

  /// No description provided for @uploadEvidence.
  ///
  /// In en, this message translates to:
  /// **'UPLOAD EVIDENCE'**
  String get uploadEvidence;

  /// No description provided for @uploadingMedia.
  ///
  /// In en, this message translates to:
  /// **'Uploading media evidence...'**
  String get uploadingMedia;

  /// No description provided for @uploadSuccess.
  ///
  /// In en, this message translates to:
  /// **'Media uploaded and linked successfully!'**
  String get uploadSuccess;

  /// No description provided for @uploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Media upload failed. Please try again.'**
  String get uploadFailed;

  /// No description provided for @takePhotoOption.
  ///
  /// In en, this message translates to:
  /// **'Take Photo'**
  String get takePhotoOption;

  /// No description provided for @recordVideoOption.
  ///
  /// In en, this message translates to:
  /// **'Record Video'**
  String get recordVideoOption;

  /// No description provided for @galleryOption.
  ///
  /// In en, this message translates to:
  /// **'Choose from Gallery'**
  String get galleryOption;

  /// No description provided for @equipmentDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'EQUIPMENT SPECIFICATIONS'**
  String get equipmentDetailsTitle;

  /// No description provided for @equipmentStatusNormal.
  ///
  /// In en, this message translates to:
  /// **'NORMAL'**
  String get equipmentStatusNormal;

  /// No description provided for @equipmentStatusWarning.
  ///
  /// In en, this message translates to:
  /// **'WARNING'**
  String get equipmentStatusWarning;

  /// No description provided for @equipmentStatusCritical.
  ///
  /// In en, this message translates to:
  /// **'CRITICAL'**
  String get equipmentStatusCritical;

  /// No description provided for @operatingTemperature.
  ///
  /// In en, this message translates to:
  /// **'Operating Temperature'**
  String get operatingTemperature;

  /// No description provided for @pressureReadout.
  ///
  /// In en, this message translates to:
  /// **'Operating Pressure'**
  String get pressureReadout;

  /// No description provided for @vibrationLevel.
  ///
  /// In en, this message translates to:
  /// **'Vibration Level'**
  String get vibrationLevel;

  /// No description provided for @motorSpeed.
  ///
  /// In en, this message translates to:
  /// **'Motor Speed (RPM)'**
  String get motorSpeed;

  /// No description provided for @lastMaintenance.
  ///
  /// In en, this message translates to:
  /// **'Last Maintenance'**
  String get lastMaintenance;

  /// No description provided for @nextScheduled.
  ///
  /// In en, this message translates to:
  /// **'Next Scheduled Inspection'**
  String get nextScheduled;

  /// No description provided for @downloadAreaPack.
  ///
  /// In en, this message translates to:
  /// **'Download Offline Area Pack'**
  String get downloadAreaPack;

  /// No description provided for @areaPackDownloaded.
  ///
  /// In en, this message translates to:
  /// **'Area pack stored for offline use.'**
  String get areaPackDownloaded;

  /// No description provided for @shiftTasksTitle.
  ///
  /// In en, this message translates to:
  /// **'Shift Maintenance Tasks'**
  String get shiftTasksTitle;

  /// No description provided for @priorityHigh.
  ///
  /// In en, this message translates to:
  /// **'HIGH PRIORITY'**
  String get priorityHigh;

  /// No description provided for @priorityMedium.
  ///
  /// In en, this message translates to:
  /// **'MEDIUM'**
  String get priorityMedium;

  /// No description provided for @priorityLow.
  ///
  /// In en, this message translates to:
  /// **'LOW'**
  String get priorityLow;

  /// No description provided for @markAsCompleted.
  ///
  /// In en, this message translates to:
  /// **'Mark Completed'**
  String get markAsCompleted;

  /// No description provided for @completedStatus.
  ///
  /// In en, this message translates to:
  /// **'COMPLETED'**
  String get completedStatus;

  /// No description provided for @pendingStatus.
  ///
  /// In en, this message translates to:
  /// **'PENDING'**
  String get pendingStatus;

  /// No description provided for @noTasksToday.
  ///
  /// In en, this message translates to:
  /// **'No maintenance tasks scheduled for this shift.'**
  String get noTasksToday;

  /// No description provided for @documentsTitle.
  ///
  /// In en, this message translates to:
  /// **'TECHNICAL DOCUMENTS & SOPS'**
  String get documentsTitle;

  /// No description provided for @manualsTab.
  ///
  /// In en, this message translates to:
  /// **'Manuals'**
  String get manualsTab;

  /// No description provided for @sopsTab.
  ///
  /// In en, this message translates to:
  /// **'SOPs'**
  String get sopsTab;

  /// No description provided for @schematicsTab.
  ///
  /// In en, this message translates to:
  /// **'Schematics'**
  String get schematicsTab;

  /// No description provided for @searchDocumentsHint.
  ///
  /// In en, this message translates to:
  /// **'Search documents and manuals...'**
  String get searchDocumentsHint;

  /// No description provided for @ingestionStatus.
  ///
  /// In en, this message translates to:
  /// **'Ingestion Status'**
  String get ingestionStatus;

  /// No description provided for @indexedPages.
  ///
  /// In en, this message translates to:
  /// **'Indexed Pages'**
  String get indexedPages;

  /// No description provided for @uploadDocumentPrompt.
  ///
  /// In en, this message translates to:
  /// **'Upload Manual / PDF'**
  String get uploadDocumentPrompt;

  /// No description provided for @settingsHeader.
  ///
  /// In en, this message translates to:
  /// **'SETTINGS'**
  String get settingsHeader;

  /// No description provided for @appearanceSection.
  ///
  /// In en, this message translates to:
  /// **'APPEARANCE'**
  String get appearanceSection;

  /// No description provided for @lightMode.
  ///
  /// In en, this message translates to:
  /// **'Light Mode'**
  String get lightMode;

  /// No description provided for @lightModeDescription.
  ///
  /// In en, this message translates to:
  /// **'Clean high-contrast technical light interface'**
  String get lightModeDescription;

  /// No description provided for @darkMode.
  ///
  /// In en, this message translates to:
  /// **'Dark Mode'**
  String get darkMode;

  /// No description provided for @darkModeDescription.
  ///
  /// In en, this message translates to:
  /// **'Industrial low-glare dark workspace'**
  String get darkModeDescription;

  /// No description provided for @systemDefault.
  ///
  /// In en, this message translates to:
  /// **'System Default'**
  String get systemDefault;

  /// No description provided for @systemDefaultDescription.
  ///
  /// In en, this message translates to:
  /// **'Match operating system appearance'**
  String get systemDefaultDescription;

  /// No description provided for @languageSection.
  ///
  /// In en, this message translates to:
  /// **'LANGUAGE / भाषा'**
  String get languageSection;

  /// No description provided for @englishLanguage.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get englishLanguage;

  /// No description provided for @englishLanguageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Industrial Technical English'**
  String get englishLanguageSubtitle;

  /// No description provided for @hindiLanguage.
  ///
  /// In en, this message translates to:
  /// **'हिन्दी (Hindi)'**
  String get hindiLanguage;

  /// No description provided for @hindiLanguageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'औद्योगिक एवं यांत्रिक शब्दावली (Technical Hindi)'**
  String get hindiLanguageSubtitle;

  /// No description provided for @userAccountSection.
  ///
  /// In en, this message translates to:
  /// **'USER ACCOUNT'**
  String get userAccountSection;

  /// No description provided for @activeRole.
  ///
  /// In en, this message translates to:
  /// **'Active Role'**
  String get activeRole;

  /// No description provided for @sessionToken.
  ///
  /// In en, this message translates to:
  /// **'Session'**
  String get sessionToken;

  /// No description provided for @activeSession.
  ///
  /// In en, this message translates to:
  /// **'Authenticated'**
  String get activeSession;

  /// No description provided for @appInfoSection.
  ///
  /// In en, this message translates to:
  /// **'APPLICATION INFORMATION'**
  String get appInfoSection;

  /// No description provided for @appVersion.
  ///
  /// In en, this message translates to:
  /// **'Version 2.4.0 (Build 2026.11)'**
  String get appVersion;

  /// No description provided for @offlineCacheTitle.
  ///
  /// In en, this message translates to:
  /// **'Offline Storage & Area Packs'**
  String get offlineCacheTitle;

  /// No description provided for @clearCacheButton.
  ///
  /// In en, this message translates to:
  /// **'Clear Offline Cache'**
  String get clearCacheButton;

  /// No description provided for @cacheClearedNotice.
  ///
  /// In en, this message translates to:
  /// **'Offline cache cleared successfully.'**
  String get cacheClearedNotice;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @errorTitle.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get errorTitle;

  /// No description provided for @genericError.
  ///
  /// In en, this message translates to:
  /// **'An unexpected error occurred. Please try again.'**
  String get genericError;

  /// No description provided for @networkError.
  ///
  /// In en, this message translates to:
  /// **'Network connection unavailable. Operating in offline mode.'**
  String get networkError;

  /// No description provided for @offlineWarning.
  ///
  /// In en, this message translates to:
  /// **'Dead zone detected: AI features will use cached manuals.'**
  String get offlineWarning;

  /// No description provided for @slurryPumpTitle.
  ///
  /// In en, this message translates to:
  /// **'Centrifugal Slurry Pump P-102'**
  String get slurryPumpTitle;

  /// No description provided for @conveyorBeltTitle.
  ///
  /// In en, this message translates to:
  /// **'Overland Conveyor Belt A61'**
  String get conveyorBeltTitle;

  /// No description provided for @hydraulicPressTitle.
  ///
  /// In en, this message translates to:
  /// **'Hydraulic Stamping Press H-400'**
  String get hydraulicPressTitle;

  /// No description provided for @compressorUnitTitle.
  ///
  /// In en, this message translates to:
  /// **'Rotary Screw Compressor C-12'**
  String get compressorUnitTitle;

  /// No description provided for @heatExchangerTitle.
  ///
  /// In en, this message translates to:
  /// **'Shell & Tube Heat Exchanger E-301'**
  String get heatExchangerTitle;

  /// No description provided for @industrialFanTitle.
  ///
  /// In en, this message translates to:
  /// **'Induced Draft Exhaust Fan F-505'**
  String get industrialFanTitle;

  /// No description provided for @equipmentStatus.
  ///
  /// In en, this message translates to:
  /// **'Equipment Status'**
  String get equipmentStatus;

  /// No description provided for @operationalState.
  ///
  /// In en, this message translates to:
  /// **'OPERATIONAL'**
  String get operationalState;

  /// No description provided for @degradedState.
  ///
  /// In en, this message translates to:
  /// **'DEGRADED'**
  String get degradedState;

  /// No description provided for @trippedState.
  ///
  /// In en, this message translates to:
  /// **'TRIPPED'**
  String get trippedState;

  /// No description provided for @offlineState.
  ///
  /// In en, this message translates to:
  /// **'OFFLINE'**
  String get offlineState;

  /// No description provided for @maintenanceDue.
  ///
  /// In en, this message translates to:
  /// **'MAINTENANCE DUE'**
  String get maintenanceDue;

  /// No description provided for @assetTag.
  ///
  /// In en, this message translates to:
  /// **'Asset Tag'**
  String get assetTag;

  /// No description provided for @serialNumber.
  ///
  /// In en, this message translates to:
  /// **'Serial Number'**
  String get serialNumber;

  /// No description provided for @manufacturer.
  ///
  /// In en, this message translates to:
  /// **'Manufacturer'**
  String get manufacturer;

  /// No description provided for @modelYear.
  ///
  /// In en, this message translates to:
  /// **'Model Year'**
  String get modelYear;

  /// No description provided for @ratedCapacity.
  ///
  /// In en, this message translates to:
  /// **'Rated Capacity'**
  String get ratedCapacity;

  /// No description provided for @operatingHours.
  ///
  /// In en, this message translates to:
  /// **'Operating Hours'**
  String get operatingHours;

  /// No description provided for @telemetryHeader.
  ///
  /// In en, this message translates to:
  /// **'REAL-TIME TELEMETRY READOUTS'**
  String get telemetryHeader;

  /// No description provided for @bearingVibration.
  ///
  /// In en, this message translates to:
  /// **'Bearing Vibration'**
  String get bearingVibration;

  /// No description provided for @casingVibration.
  ///
  /// In en, this message translates to:
  /// **'Casing Vibration'**
  String get casingVibration;

  /// No description provided for @suctionPressure.
  ///
  /// In en, this message translates to:
  /// **'Suction Pressure'**
  String get suctionPressure;

  /// No description provided for @dischargePressure.
  ///
  /// In en, this message translates to:
  /// **'Discharge Pressure'**
  String get dischargePressure;

  /// No description provided for @windingTemperature.
  ///
  /// In en, this message translates to:
  /// **'Motor Winding Temp'**
  String get windingTemperature;

  /// No description provided for @oilTemperature.
  ///
  /// In en, this message translates to:
  /// **'Lube Oil Temp'**
  String get oilTemperature;

  /// No description provided for @bearingTemperature.
  ///
  /// In en, this message translates to:
  /// **'Drive Bearing Temp'**
  String get bearingTemperature;

  /// No description provided for @flowRate.
  ///
  /// In en, this message translates to:
  /// **'Volumetric Flow Rate'**
  String get flowRate;

  /// No description provided for @powerConsumption.
  ///
  /// In en, this message translates to:
  /// **'Current Power Draw'**
  String get powerConsumption;

  /// No description provided for @unitPsi.
  ///
  /// In en, this message translates to:
  /// **'PSI'**
  String get unitPsi;

  /// No description provided for @unitBar.
  ///
  /// In en, this message translates to:
  /// **'bar'**
  String get unitBar;

  /// No description provided for @unitKpa.
  ///
  /// In en, this message translates to:
  /// **'kPa'**
  String get unitKpa;

  /// No description provided for @unitRpm.
  ///
  /// In en, this message translates to:
  /// **'RPM'**
  String get unitRpm;

  /// No description provided for @unitCelsius.
  ///
  /// In en, this message translates to:
  /// **'°C'**
  String get unitCelsius;

  /// No description provided for @unitFahrenheit.
  ///
  /// In en, this message translates to:
  /// **'°F'**
  String get unitFahrenheit;

  /// No description provided for @unitMmPerSec.
  ///
  /// In en, this message translates to:
  /// **'mm/s RMS'**
  String get unitMmPerSec;

  /// No description provided for @unitKw.
  ///
  /// In en, this message translates to:
  /// **'kW'**
  String get unitKw;

  /// No description provided for @unitAmps.
  ///
  /// In en, this message translates to:
  /// **'A'**
  String get unitAmps;

  /// No description provided for @unitVolts.
  ///
  /// In en, this message translates to:
  /// **'V'**
  String get unitVolts;

  /// No description provided for @unitHours.
  ///
  /// In en, this message translates to:
  /// **'hrs'**
  String get unitHours;

  /// No description provided for @lotoProtocolTitle.
  ///
  /// In en, this message translates to:
  /// **'LOCKOUT / TAGOUT (LOTO) PROCEDURE'**
  String get lotoProtocolTitle;

  /// No description provided for @lotoStep1.
  ///
  /// In en, this message translates to:
  /// **'1. Notify affected personnel of equipment shutdown.'**
  String get lotoStep1;

  /// No description provided for @lotoStep2.
  ///
  /// In en, this message translates to:
  /// **'2. Execute controlled shutdown from local control panel.'**
  String get lotoStep2;

  /// No description provided for @lotoStep3.
  ///
  /// In en, this message translates to:
  /// **'3. Isolate main 480V circuit breaker at MCC-02.'**
  String get lotoStep3;

  /// No description provided for @lotoStep4.
  ///
  /// In en, this message translates to:
  /// **'4. Apply personal safety padlock and danger tag.'**
  String get lotoStep4;

  /// No description provided for @lotoStep5.
  ///
  /// In en, this message translates to:
  /// **'5. Depressurize hydraulic and pneumatic lines.'**
  String get lotoStep5;

  /// No description provided for @lotoStep6.
  ///
  /// In en, this message translates to:
  /// **'6. Verify zero energy state using calibrated multimeter.'**
  String get lotoStep6;

  /// No description provided for @zeroEnergyVerified.
  ///
  /// In en, this message translates to:
  /// **'Zero Energy State Verified'**
  String get zeroEnergyVerified;

  /// No description provided for @ppeRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'MANDATORY PERSONAL PROTECTIVE EQUIPMENT (PPE)'**
  String get ppeRequiredTitle;

  /// No description provided for @ppeHardHat.
  ///
  /// In en, this message translates to:
  /// **'Hard Hat (ANSI Z89.1)'**
  String get ppeHardHat;

  /// No description provided for @ppeSafetyGlasses.
  ///
  /// In en, this message translates to:
  /// **'Safety Glasses with Side Shields'**
  String get ppeSafetyGlasses;

  /// No description provided for @ppeEarProtection.
  ///
  /// In en, this message translates to:
  /// **'Hearing Protection (NRR 28+ dB)'**
  String get ppeEarProtection;

  /// No description provided for @ppeSteelToeBoots.
  ///
  /// In en, this message translates to:
  /// **'Steel Toe Work Boots'**
  String get ppeSteelToeBoots;

  /// No description provided for @ppeHeatResistantGloves.
  ///
  /// In en, this message translates to:
  /// **'Heavy Duty Mechanics Gloves'**
  String get ppeHeatResistantGloves;

  /// No description provided for @hazardArcFlash.
  ///
  /// In en, this message translates to:
  /// **'DANGER: Arc Flash & Shock Hazard'**
  String get hazardArcFlash;

  /// No description provided for @hazardHighPressure.
  ///
  /// In en, this message translates to:
  /// **'WARNING: High Pressure Fluid Injection Hazard'**
  String get hazardHighPressure;

  /// No description provided for @hazardRotatingMachinery.
  ///
  /// In en, this message translates to:
  /// **'CAUTION: Rotating Mechanical Shafts'**
  String get hazardRotatingMachinery;

  /// No description provided for @hazardHotSurfaces.
  ///
  /// In en, this message translates to:
  /// **'CAUTION: Hot Surfaces Exceeding 70°C'**
  String get hazardHotSurfaces;

  /// No description provided for @emergencyStopTriggered.
  ///
  /// In en, this message translates to:
  /// **'EMERGENCY STOP (E-STOP) ACTIVATED'**
  String get emergencyStopTriggered;

  /// No description provided for @permitToWorkRequired.
  ///
  /// In en, this message translates to:
  /// **'Safe Work Permit (SWP) Required Prior to Entry'**
  String get permitToWorkRequired;

  /// No description provided for @impellerComponent.
  ///
  /// In en, this message translates to:
  /// **'Closed Shrouded Impeller'**
  String get impellerComponent;

  /// No description provided for @mechanicalSealComponent.
  ///
  /// In en, this message translates to:
  /// **'Cartridge Mechanical Seal'**
  String get mechanicalSealComponent;

  /// No description provided for @shaftComponent.
  ///
  /// In en, this message translates to:
  /// **'Forged Alloy Drive Shaft'**
  String get shaftComponent;

  /// No description provided for @suctionCoverComponent.
  ///
  /// In en, this message translates to:
  /// **'Suction Liner Plate'**
  String get suctionCoverComponent;

  /// No description provided for @voluteCasingComponent.
  ///
  /// In en, this message translates to:
  /// **'Heavy Duty Volute Casing'**
  String get voluteCasingComponent;

  /// No description provided for @bearingHousingComponent.
  ///
  /// In en, this message translates to:
  /// **'Grease Lubricated Bearing Housing'**
  String get bearingHousingComponent;

  /// No description provided for @wearRingComponent.
  ///
  /// In en, this message translates to:
  /// **'Replaceable Bronze Wear Ring'**
  String get wearRingComponent;

  /// No description provided for @stuffingBoxComponent.
  ///
  /// In en, this message translates to:
  /// **'High Pressure Stuffing Box'**
  String get stuffingBoxComponent;

  /// No description provided for @lanternRingComponent.
  ///
  /// In en, this message translates to:
  /// **'PTFE Flush Lantern Ring'**
  String get lanternRingComponent;

  /// No description provided for @couplingComponent.
  ///
  /// In en, this message translates to:
  /// **'Flexible Jaw Coupling'**
  String get couplingComponent;

  /// No description provided for @gasketComponent.
  ///
  /// In en, this message translates to:
  /// **'Spiral Wound Metallic Gasket'**
  String get gasketComponent;

  /// No description provided for @oRingComponent.
  ///
  /// In en, this message translates to:
  /// **'Fluoroelastomer O-Ring Seal'**
  String get oRingComponent;

  /// No description provided for @componentTorqueSpecs.
  ///
  /// In en, this message translates to:
  /// **'Bolt Torque Specifications'**
  String get componentTorqueSpecs;

  /// No description provided for @torqueNm.
  ///
  /// In en, this message translates to:
  /// **'N·m'**
  String get torqueNm;

  /// No description provided for @torqueFootPounds.
  ///
  /// In en, this message translates to:
  /// **'ft-lb'**
  String get torqueFootPounds;

  /// No description provided for @assemblyOverview.
  ///
  /// In en, this message translates to:
  /// **'Assembly Hierarchy & Sub-components'**
  String get assemblyOverview;

  /// No description provided for @disassemblySequence.
  ///
  /// In en, this message translates to:
  /// **'Safe Disassembly Sequence'**
  String get disassemblySequence;

  /// No description provided for @reassemblySequence.
  ///
  /// In en, this message translates to:
  /// **'Standard Reassembly Sequence'**
  String get reassemblySequence;

  /// No description provided for @inspectionTolerances.
  ///
  /// In en, this message translates to:
  /// **'Clearance & Runout Tolerances'**
  String get inspectionTolerances;

  /// No description provided for @diagnosticsTitle.
  ///
  /// In en, this message translates to:
  /// **'GUIDED INDUSTRIAL FAULT DIAGNOSTICS'**
  String get diagnosticsTitle;

  /// No description provided for @symptomSelectorTitle.
  ///
  /// In en, this message translates to:
  /// **'Select Observed Symptom'**
  String get symptomSelectorTitle;

  /// No description provided for @symptomHighVibration.
  ///
  /// In en, this message translates to:
  /// **'Abnormal vibration exceeding 4.5 mm/s'**
  String get symptomHighVibration;

  /// No description provided for @symptomExcessiveHeat.
  ///
  /// In en, this message translates to:
  /// **'Bearing temperature alarm (>85°C)'**
  String get symptomExcessiveHeat;

  /// No description provided for @symptomCavitation.
  ///
  /// In en, this message translates to:
  /// **'Cavitation noise (popping / marbles in casing)'**
  String get symptomCavitation;

  /// No description provided for @symptomLowFlow.
  ///
  /// In en, this message translates to:
  /// **'Discharge flow rate below operational curve'**
  String get symptomLowFlow;

  /// No description provided for @symptomSealLeakage.
  ///
  /// In en, this message translates to:
  /// **'Fluid weeping from mechanical seal gland'**
  String get symptomSealLeakage;

  /// No description provided for @symptomMotorOverload.
  ///
  /// In en, this message translates to:
  /// **'Motor thermal overload trip'**
  String get symptomMotorOverload;

  /// No description provided for @rootCauseAnalysis.
  ///
  /// In en, this message translates to:
  /// **'Probable Root Causes'**
  String get rootCauseAnalysis;

  /// No description provided for @recommendedAction.
  ///
  /// In en, this message translates to:
  /// **'Recommended Corrective Action'**
  String get recommendedAction;

  /// No description provided for @estimatedRepairTime.
  ///
  /// In en, this message translates to:
  /// **'Estimated Downtime / Repair Time'**
  String get estimatedRepairTime;

  /// No description provided for @toolsRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Specialized Tools Required'**
  String get toolsRequiredTitle;

  /// No description provided for @replacementPartsTitle.
  ///
  /// In en, this message translates to:
  /// **'Recommended Replacement Parts'**
  String get replacementPartsTitle;

  /// No description provided for @searchSopHint.
  ///
  /// In en, this message translates to:
  /// **'Search SOP, schematics, or equipment code...'**
  String get searchSopHint;

  /// No description provided for @filterAll.
  ///
  /// In en, this message translates to:
  /// **'All Documents'**
  String get filterAll;

  /// No description provided for @filterManuals.
  ///
  /// In en, this message translates to:
  /// **'OEM Manuals'**
  String get filterManuals;

  /// No description provided for @filterSops.
  ///
  /// In en, this message translates to:
  /// **'Maintenance SOPs'**
  String get filterSops;

  /// No description provided for @filterElectrical.
  ///
  /// In en, this message translates to:
  /// **'Single Line & Electrical'**
  String get filterElectrical;

  /// No description provided for @filterPid.
  ///
  /// In en, this message translates to:
  /// **'P&ID Flow Schematics'**
  String get filterPid;

  /// No description provided for @documentSize.
  ///
  /// In en, this message translates to:
  /// **'File Size'**
  String get documentSize;

  /// No description provided for @documentPages.
  ///
  /// In en, this message translates to:
  /// **'Total Pages'**
  String get documentPages;

  /// No description provided for @documentUploaded.
  ///
  /// In en, this message translates to:
  /// **'Upload Date'**
  String get documentUploaded;

  /// No description provided for @documentVerified.
  ///
  /// In en, this message translates to:
  /// **'Engineering Verified'**
  String get documentVerified;

  /// No description provided for @downloadPdf.
  ///
  /// In en, this message translates to:
  /// **'Download Technical PDF'**
  String get downloadPdf;

  /// No description provided for @openDocument.
  ///
  /// In en, this message translates to:
  /// **'View Document in Viewer'**
  String get openDocument;

  /// No description provided for @uploadSopDocument.
  ///
  /// In en, this message translates to:
  /// **'Ingest New Engineering SOP'**
  String get uploadSopDocument;

  /// No description provided for @ingestionProgress.
  ///
  /// In en, this message translates to:
  /// **'Extracting vectors and indexing text...'**
  String get ingestionProgress;

  /// No description provided for @ingestionCompleted.
  ///
  /// In en, this message translates to:
  /// **'Document successfully vectorized into RAG index.'**
  String get ingestionCompleted;

  /// No description provided for @shiftSummary.
  ///
  /// In en, this message translates to:
  /// **'Active Shift Summary'**
  String get shiftSummary;

  /// No description provided for @shiftLead.
  ///
  /// In en, this message translates to:
  /// **'Shift Supervisor'**
  String get shiftLead;

  /// No description provided for @assignedCrew.
  ///
  /// In en, this message translates to:
  /// **'Assigned Maintenance Crew'**
  String get assignedCrew;

  /// No description provided for @scheduledTasks.
  ///
  /// In en, this message translates to:
  /// **'Scheduled Preventative Tasks'**
  String get scheduledTasks;

  /// No description provided for @unscheduledTasks.
  ///
  /// In en, this message translates to:
  /// **'Unscheduled Corrective Tasks'**
  String get unscheduledTasks;

  /// No description provided for @checklistVerification.
  ///
  /// In en, this message translates to:
  /// **'Task Verification Checklist'**
  String get checklistVerification;

  /// No description provided for @signatureRequired.
  ///
  /// In en, this message translates to:
  /// **'Engineer Sign-off Signature'**
  String get signatureRequired;

  /// No description provided for @signOffButton.
  ///
  /// In en, this message translates to:
  /// **'SUBMIT SHIFT SIGN-OFF'**
  String get signOffButton;

  /// No description provided for @taskStatusDueToday.
  ///
  /// In en, this message translates to:
  /// **'DUE TODAY'**
  String get taskStatusDueToday;

  /// No description provided for @taskStatusOverdue.
  ///
  /// In en, this message translates to:
  /// **'OVERDUE'**
  String get taskStatusOverdue;

  /// No description provided for @taskStatusInProgress.
  ///
  /// In en, this message translates to:
  /// **'WORK IN PROGRESS'**
  String get taskStatusInProgress;

  /// No description provided for @taskStatusComplete.
  ///
  /// In en, this message translates to:
  /// **'WORK COMPLETED'**
  String get taskStatusComplete;

  /// No description provided for @cameraPreviewTitle.
  ///
  /// In en, this message translates to:
  /// **'INDUSTRIAL EVIDENCE CAPTURE'**
  String get cameraPreviewTitle;

  /// No description provided for @shutterButton.
  ///
  /// In en, this message translates to:
  /// **'Capture Frame'**
  String get shutterButton;

  /// No description provided for @flashModeOn.
  ///
  /// In en, this message translates to:
  /// **'Flash: On'**
  String get flashModeOn;

  /// No description provided for @flashModeOff.
  ///
  /// In en, this message translates to:
  /// **'Flash: Off'**
  String get flashModeOff;

  /// No description provided for @flashModeAuto.
  ///
  /// In en, this message translates to:
  /// **'Flash: Auto'**
  String get flashModeAuto;

  /// No description provided for @switchCamera.
  ///
  /// In en, this message translates to:
  /// **'Switch Front/Back Camera'**
  String get switchCamera;

  /// No description provided for @evidenceType.
  ///
  /// In en, this message translates to:
  /// **'Evidence Category'**
  String get evidenceType;

  /// No description provided for @evidenceTypeDefect.
  ///
  /// In en, this message translates to:
  /// **'Component Defect / Wear'**
  String get evidenceTypeDefect;

  /// No description provided for @evidenceTypeRepair.
  ///
  /// In en, this message translates to:
  /// **'Post-Repair Verification'**
  String get evidenceTypeRepair;

  /// No description provided for @evidenceTypeRoutine.
  ///
  /// In en, this message translates to:
  /// **'Routine Visual Inspection'**
  String get evidenceTypeRoutine;

  /// No description provided for @evidenceTypeSafety.
  ///
  /// In en, this message translates to:
  /// **'Safety Violation / Hazard'**
  String get evidenceTypeSafety;

  /// No description provided for @attachToActiveChat.
  ///
  /// In en, this message translates to:
  /// **'Send to Active Consultation'**
  String get attachToActiveChat;

  /// No description provided for @ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// No description provided for @apply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get apply;

  /// No description provided for @discard.
  ///
  /// In en, this message translates to:
  /// **'Discard Changes'**
  String get discard;

  /// No description provided for @noResultsFound.
  ///
  /// In en, this message translates to:
  /// **'No matching records found'**
  String get noResultsFound;

  /// No description provided for @refreshing.
  ///
  /// In en, this message translates to:
  /// **'Refreshing telemetry feed...'**
  String get refreshing;

  /// No description provided for @refreshComplete.
  ///
  /// In en, this message translates to:
  /// **'Telemetry synchronized.'**
  String get refreshComplete;

  /// No description provided for @connectionSecure.
  ///
  /// In en, this message translates to:
  /// **'TLS 1.3 Encrypted Industrial Connection'**
  String get connectionSecure;

  /// No description provided for @sessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Session expired. Please re-authenticate.'**
  String get sessionExpired;

  /// No description provided for @developerMode.
  ///
  /// In en, this message translates to:
  /// **'Diagnostic Telemetry Console'**
  String get developerMode;

  /// No description provided for @ballBearing.
  ///
  /// In en, this message translates to:
  /// **'Deep Groove Ball Bearing'**
  String get ballBearing;

  /// No description provided for @rollerBearing.
  ///
  /// In en, this message translates to:
  /// **'Cylindrical Roller Bearing'**
  String get rollerBearing;

  /// No description provided for @sphericalBearing.
  ///
  /// In en, this message translates to:
  /// **'Spherical Roller Bearing'**
  String get sphericalBearing;

  /// No description provided for @thrustBearing.
  ///
  /// In en, this message translates to:
  /// **'Angular Contact Thrust Bearing'**
  String get thrustBearing;

  /// No description provided for @gridCoupling.
  ///
  /// In en, this message translates to:
  /// **'Tapered Grid Flexible Coupling'**
  String get gridCoupling;

  /// No description provided for @gearCoupling.
  ///
  /// In en, this message translates to:
  /// **'Double Engagement Gear Coupling'**
  String get gearCoupling;

  /// No description provided for @discCoupling.
  ///
  /// In en, this message translates to:
  /// **'Metallic Disc Pack Coupling'**
  String get discCoupling;

  /// No description provided for @lipSeal.
  ///
  /// In en, this message translates to:
  /// **'Radial Shaft Lip Seal'**
  String get lipSeal;

  /// No description provided for @labyrinthSeal.
  ///
  /// In en, this message translates to:
  /// **'Non-contacting Labyrinth Seal'**
  String get labyrinthSeal;

  /// No description provided for @glandPacking.
  ///
  /// In en, this message translates to:
  /// **'Graphite Impregnated Gland Packing'**
  String get glandPacking;

  /// No description provided for @butterflyValve.
  ///
  /// In en, this message translates to:
  /// **'Wafer Style Butterfly Valve'**
  String get butterflyValve;

  /// No description provided for @gateValve.
  ///
  /// In en, this message translates to:
  /// **'Cast Steel Wedge Gate Valve'**
  String get gateValve;

  /// No description provided for @ballValve.
  ///
  /// In en, this message translates to:
  /// **'Three-piece Trunnion Ball Valve'**
  String get ballValve;

  /// No description provided for @checkValve.
  ///
  /// In en, this message translates to:
  /// **'Dual Plate Swing Check Valve'**
  String get checkValve;

  /// No description provided for @globeValve.
  ///
  /// In en, this message translates to:
  /// **'Flanged Control Globe Valve'**
  String get globeValve;

  /// No description provided for @reliefValve.
  ///
  /// In en, this message translates to:
  /// **'Direct Spring Loaded Pressure Relief Valve'**
  String get reliefValve;

  /// No description provided for @vBelt.
  ///
  /// In en, this message translates to:
  /// **'Heavy Duty Cogged V-Belt'**
  String get vBelt;

  /// No description provided for @timingBelt.
  ///
  /// In en, this message translates to:
  /// **'High Torque Synchronous Timing Belt'**
  String get timingBelt;

  /// No description provided for @failureMisalignment.
  ///
  /// In en, this message translates to:
  /// **'Angular & Parallel Shaft Misalignment'**
  String get failureMisalignment;

  /// No description provided for @failureUnbalance.
  ///
  /// In en, this message translates to:
  /// **'Static & Dynamic Rotor Unbalance'**
  String get failureUnbalance;

  /// No description provided for @failureMechanicalLooseness.
  ///
  /// In en, this message translates to:
  /// **'Structural / Foundation Mechanical Looseness'**
  String get failureMechanicalLooseness;

  /// No description provided for @failureCavitation.
  ///
  /// In en, this message translates to:
  /// **'Suction Recirculation & Blade Cavitation'**
  String get failureCavitation;

  /// No description provided for @failureThermalGrowth.
  ///
  /// In en, this message translates to:
  /// **'Thermal Expansion Strain on Casing'**
  String get failureThermalGrowth;

  /// No description provided for @failureLubricationStarvation.
  ///
  /// In en, this message translates to:
  /// **'Boundary Lubrication Breakdown'**
  String get failureLubricationStarvation;

  /// No description provided for @failureFatigueCracking.
  ///
  /// In en, this message translates to:
  /// **'Torsional Cyclic Fatigue Cracking'**
  String get failureFatigueCracking;

  /// No description provided for @failureFrettingCorrosion.
  ///
  /// In en, this message translates to:
  /// **'Fretting Corrosion & False Brinelling'**
  String get failureFrettingCorrosion;

  /// No description provided for @failurePitting.
  ///
  /// In en, this message translates to:
  /// **'Gear Tooth Contact Stress Pitting'**
  String get failurePitting;

  /// No description provided for @spectrum1X.
  ///
  /// In en, this message translates to:
  /// **'1X Running Speed Harmonics'**
  String get spectrum1X;

  /// No description provided for @spectrum2X.
  ///
  /// In en, this message translates to:
  /// **'2X Harmonic Frequency Peak'**
  String get spectrum2X;

  /// No description provided for @subharmonicVibration.
  ///
  /// In en, this message translates to:
  /// **'Subharmonic Oil Whirl Instability'**
  String get subharmonicVibration;

  /// No description provided for @permitHotWork.
  ///
  /// In en, this message translates to:
  /// **'Hot Work Permit (Cutting & Welding)'**
  String get permitHotWork;

  /// No description provided for @permitColdWork.
  ///
  /// In en, this message translates to:
  /// **'Cold Work Mechanical Maintenance Permit'**
  String get permitColdWork;

  /// No description provided for @permitConfinedSpace.
  ///
  /// In en, this message translates to:
  /// **'Confined Space Entry Permit (CSEP)'**
  String get permitConfinedSpace;

  /// No description provided for @permitWorkingAtHeights.
  ///
  /// In en, this message translates to:
  /// **'Fall Protection & Working at Heights Permit'**
  String get permitWorkingAtHeights;

  /// No description provided for @permitLineBreak.
  ///
  /// In en, this message translates to:
  /// **'Hazardous Piping Line Break Permit'**
  String get permitLineBreak;

  /// No description provided for @permitElectrical.
  ///
  /// In en, this message translates to:
  /// **'Energized Electrical Work Permit (EEWP)'**
  String get permitElectrical;

  /// No description provided for @permitRadiation.
  ///
  /// In en, this message translates to:
  /// **'Industrial Radiography Safety Permit'**
  String get permitRadiation;

  /// No description provided for @permitChemical.
  ///
  /// In en, this message translates to:
  /// **'Hazardous Chemical Handling Authorization'**
  String get permitChemical;

  /// No description provided for @syncInProgress.
  ///
  /// In en, this message translates to:
  /// **'Synchronizing plant data and offline changes...'**
  String get syncInProgress;

  /// No description provided for @syncSuccess.
  ///
  /// In en, this message translates to:
  /// **'All offline records and attachments synchronized.'**
  String get syncSuccess;

  /// No description provided for @syncFailed.
  ///
  /// In en, this message translates to:
  /// **'Synchronization failed. Cached changes saved locally.'**
  String get syncFailed;

  /// No description provided for @offlineItemsQueued.
  ///
  /// In en, this message translates to:
  /// **'Queued for synchronization: {count} items'**
  String offlineItemsQueued(int count);

  /// No description provided for @conflictsResolved.
  ///
  /// In en, this message translates to:
  /// **'Data conflicts resolved automatically with server master.'**
  String get conflictsResolved;

  /// No description provided for @alertCritical.
  ///
  /// In en, this message translates to:
  /// **'CRITICAL ALARM: Immediate shutdown recommended'**
  String get alertCritical;

  /// No description provided for @alertWarning.
  ///
  /// In en, this message translates to:
  /// **'PROCESS WARNING: Parameter approaching threshold'**
  String get alertWarning;

  /// No description provided for @alertInfo.
  ///
  /// In en, this message translates to:
  /// **'OPERATIONAL NOTE: Routine verification required'**
  String get alertInfo;

  /// No description provided for @maintenanceReminder.
  ///
  /// In en, this message translates to:
  /// **'Preventative maintenance scheduled within 24 hours'**
  String get maintenanceReminder;

  /// No description provided for @calibrationExpired.
  ///
  /// In en, this message translates to:
  /// **'Instrument calibration expired. Re-certification required.'**
  String get calibrationExpired;

  /// No description provided for @edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// No description provided for @view.
  ///
  /// In en, this message translates to:
  /// **'View'**
  String get view;

  /// No description provided for @download.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get download;

  /// No description provided for @share.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get share;

  /// No description provided for @copy.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get copy;

  /// No description provided for @copiedToClipboard.
  ///
  /// In en, this message translates to:
  /// **'Copied to clipboard'**
  String get copiedToClipboard;

  /// No description provided for @filter.
  ///
  /// In en, this message translates to:
  /// **'Filter'**
  String get filter;

  /// No description provided for @sort.
  ///
  /// In en, this message translates to:
  /// **'Sort'**
  String get sort;

  /// No description provided for @search.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get search;

  /// No description provided for @details.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get details;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// No description provided for @time.
  ///
  /// In en, this message translates to:
  /// **'Time'**
  String get time;

  /// No description provided for @date.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get date;

  /// No description provided for @notes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get notes;

  /// No description provided for @summary.
  ///
  /// In en, this message translates to:
  /// **'Summary'**
  String get summary;

  /// No description provided for @description.
  ///
  /// In en, this message translates to:
  /// **'Description'**
  String get description;

  /// No description provided for @tags.
  ///
  /// In en, this message translates to:
  /// **'Tags'**
  String get tags;

  /// No description provided for @type.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get type;

  /// No description provided for @category.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get category;

  /// No description provided for @size.
  ///
  /// In en, this message translates to:
  /// **'Size'**
  String get size;

  /// No description provided for @version.
  ///
  /// In en, this message translates to:
  /// **'Version'**
  String get version;

  /// No description provided for @author.
  ///
  /// In en, this message translates to:
  /// **'Author'**
  String get author;

  /// No description provided for @source.
  ///
  /// In en, this message translates to:
  /// **'Source'**
  String get source;

  /// No description provided for @location.
  ///
  /// In en, this message translates to:
  /// **'Plant Location'**
  String get location;

  /// No description provided for @unitArea.
  ///
  /// In en, this message translates to:
  /// **'Process Area / Unit'**
  String get unitArea;

  /// No description provided for @line.
  ///
  /// In en, this message translates to:
  /// **'Production Line'**
  String get line;

  /// No description provided for @station.
  ///
  /// In en, this message translates to:
  /// **'Workstation'**
  String get station;

  /// No description provided for @systemHealth.
  ///
  /// In en, this message translates to:
  /// **'System Health: Nominal'**
  String get systemHealth;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'hi':
      return AppLocalizationsHi();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
