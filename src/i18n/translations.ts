import type { AppLanguage } from '../types/assistant';

export interface TranslationDictionary {
  brandName: string;
  nav: {
    assistant: string;
    tasks: string;
    emails: string;
    files: string;
    calendar: string;
    memory: string;
    automations: string;
    research: string;
    workbench: string;
    hub: string;
    settings: string;
    workspaceModules: string;
    system: string;
    openMenu: string;
    closeMenu: string;
  };
  topbar: {
    newThread: string;
    openAssistant: string;
    refreshStatus: string;
    online: string;
    offline: string;
    pendingSync: string;
    syncNow: string;
    syncing: string;
  };
  auth: {
    localWorkspace: string;
    signInWithGoogle: string;
    signOut: string;
    signedIn: string;
    cloudSyncActive: string;
    offlineLocalOnly: string;
    signInPrompt: string;
    authErrorTitle: string;
    connectWorkspaceQuick: string;
    workspaceSessionActive: string;
    workspaceNeedsRefresh: string;
  };
  pwa: {
    installApp: string;
    installOnIOS: string;
    iosTitle: string;
    iosStep1: string;
    iosStep2: string;
    close: string;
    installed: string;
  };
  offline: {
    bannerTitle: string;
    bannerDetail: string;
    aiUnavailableOffline: string;
    syncFailedPrefix: string;
    syncCompleted: string;
    queuedLocally: string;
    lastSynced: string;
  };
  chat: {
    threads: string;
    heroKicker: string;
    heroSubtitle: string;
    registeredModules: string;
    modulesCountLabel: string;
    statusConnected: string;
    statusReady: string;
    you: string;
    assistantName: string;
    thinking: string;
    requestErrorTitle: string;
    dismiss: string;
    composerLabel: string;
    composerPlaceholder: string;
    composerPlaceholderOffline: string;
    send: string;
    composerHint: string;
    voiceStart: string;
    voiceStop: string;
    voiceListening: string;
    voiceTranscribing: string;
    voiceUnsupported: string;
    voiceError: string;
    emptyPromptTitle: string;
    geminiKeyTitle: string;
    geminiKeyBody: string;
    starterPrompt1: string;
    starterPrompt2: string;
    starterPrompt3: string;
    toolExecutedPrefix: string;
    runningComputerTools: string;
    computerFoldersLabel: string;
    connectFolderQuick: string;
    noFoldersQuick: string;
    deleteConfirmTitle: string;
    deleteConfirmBody: string;
    deleteConfirmProceed: string;
    deleteConfirmCancel: string;
    captureScreen: string;
    attachFileOrImage: string;
    attachmentsLabel: string;
    removeAttachment: string;
    speakReply: string;
    stopSpeaking: string;
    newChat: string;
    plugins: string;
    explore: string;
    searchChatsPlaceholder: string;
    historyToday: string;
    historyWeek: string;
    historyOlder: string;
    noMatchingChats: string;
    toggleHistory: string;
    deleteChat: string;
    backToChat: string;
    exploreTitle: string;
    exploreSubtitle: string;
    pluginsTitle: string;
    pluginsSubtitle: string;
    pluginActive: string;
    pluginNeedsConnect: string;
    openModule: string;
    tryPrompt: string;
  };
  tasks: {
    kicker: string;
    title: string;
    subtitle: string;
    addPlaceholder: string;
    dueDateLabel: string;
    priorityLabel: string;
    priorityLow: string;
    priorityMedium: string;
    priorityHigh: string;
    addButton: string;
    searchPlaceholder: string;
    filterAll: string;
    filterOpen: string;
    filterCompleted: string;
    emptyTitle: string;
    emptySubtitle: string;
    markDone: string;
    reopen: string;
    editTask: string;
    saveEdit: string;
    cancelEdit: string;
    deleteTask: string;
    sourceLabel: string;
    originalTextLabel: string;
    statusTodo: string;
    statusInProgress: string;
    statusCompleted: string;
    askAssistant: string;
    askAssistantPrompt: string;
  };
  calendar: {
    kicker: string;
    title: string;
    subtitle: string;
    eventTitlePlaceholder: string;
    startTimeLabel: string;
    locationPlaceholder: string;
    addButton: string;
    emptyTitle: string;
    emptySubtitle: string;
    deleteEvent: string;
    askAssistant: string;
    askAssistantPrompt: string;
    connectGoogleCalendar: string;
    pullGoogleEvents: string;
    syncingGoogle: string;
    pushToGoogleLabel: string;
    googleConnectedNotice: string;
    googlePullSuccess: string;
    googleDeleteConfirmTitle: string;
    googleDeleteConfirmBody: string;
    googleDeleteCancel: string;
    googleDeleteProceed: string;
    quickTestOneMin: string;
    scheduledActionLabel: string;
    actionNone: string;
    actionCreateFolder: string;
    actionDownloadUrl: string;
    actionCreateTask: string;
    actionCreateDocument: string;
    actionFolderPlaceholder: string;
    actionUrlPlaceholder: string;
    actionTaskPlaceholder: string;
    actionDocPlaceholder: string;
    eventAlertBannerPrefix: string;
    actionStatusPending: string;
    actionStatusExecuted: string;
    actionStatusFailed: string;
  };
  files: {
    kicker: string;
    title: string;
    subtitle: string;
    docTitlePlaceholder: string;
    folderPlaceholder: string;
    contentPlaceholder: string;
    saveButton: string;
    searchPlaceholder: string;
    cachedOfflineLabel: string;
    toggleOfflineCache: string;
    deleteDoc: string;
    emptyTitle: string;
    emptySubtitle: string;
    askAssistant: string;
    askAssistantPrompt: string;
    importFile: string;
    exportFile: string;
    importedFolderLabel: string;
    fileActionError: string;
    computerSectionTitle: string;
    computerSectionDesc: string;
    connectComputerFolder: string;
    noComputerFolders: string;
    iframeBlockedNote: string;
    unsupportedFolderPickerNote: string;
    folderPermissionGranted: string;
    folderPermissionPrompt: string;
    reconnectFolder: string;
    disconnectFolder: string;
    refreshFolder: string;
    askAgentFolder: string;
    askAgentFolderPromptPrefix: string;
    newSubfolderPlaceholder: string;
    createSubfolderButton: string;
    newPcFilePlaceholder: string;
    newPcFileContentPlaceholder: string;
    createPcFileButton: string;
    searchPcPlaceholder: string;
    upOneLevel: string;
    rootLevel: string;
    itemsLabel: string;
    openFolderAction: string;
    viewFileAction: string;
    renameAction: string;
    renamePlaceholder: string;
    saveRename: string;
    deletePcEntryAction: string;
    emptyFolderNotice: string;
    filePreviewTitle: string;
    saveFileChanges: string;
    closePreview: string;
  };
  emails: {
    kicker: string;
    title: string;
    subtitle: string;
    noAccountTitle: string;
    noAccountBody: string;
    capabilitiesTitle: string;
    cap1Title: string;
    cap1Desc: string;
    cap2Title: string;
    cap2Desc: string;
    nextStepsTitle: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    askAssistant: string;
    askAssistantPrompt: string;
    connectButton: string;
    reconnectButton: string;
    connectedAsLabel: string;
    refreshInbox: string;
    searchPlaceholder: string;
    searchButton: string;
    composeButton: string;
    summarizeInboxAi: string;
    loadingInbox: string;
    emptyInbox: string;
    selectMessagePrompt: string;
    fromLabel: string;
    toLabel: string;
    dateLabel: string;
    subjectLabel: string;
    bodyLabel: string;
    replyButton: string;
    summarizeMessageAi: string;
    draftReplyAi: string;
    saveDraftButton: string;
    sendEmailButton: string;
    closeCompose: string;
    draftSavedNotice: string;
    emailSentNotice: string;
    sendConfirmTitle: string;
    sendConfirmBody: string;
    sendConfirmCancel: string;
    sendConfirmProceed: string;
    offlineNotice: string;
    unreadLabel: string;
    dailySummaryTitle: string;
    dailySummarySubtitle: string;
    dailySummaryScheduleBadge: string;
    summarizeImportantNow: string;
    summarizingImportant: string;
    dailyConclusionLabel: string;
    noImportantEmails: string;
    importantCountLabel: string;
    scannedCountLabel: string;
    rememberedConnectionTitle: string;
    rememberedConnectionBody: string;
    refreshLiveSession: string;
    apiDisabledTitle: string;
    apiDisabledBody: string;
    enableGmailApi: string;
    enableCalendarApi: string;
    retryConnection: string;
    validationToRequired: string;
    sendingStatus: string;
    disconnectMailbox: string;
  };
  memory: {
    kicker: string;
    title: string;
    subtitle: string;
    factPlaceholder: string;
    categoryPreference: string;
    categoryContext: string;
    categoryWorkflow: string;
    saveButton: string;
    searchPlaceholder: string;
    deleteMemory: string;
    emptyTitle: string;
    emptySubtitle: string;
    askAssistant: string;
    askAssistantPrompt: string;
  };
  automations: {
    kicker: string;
    title: string;
    subtitle: string;
    namePlaceholder: string;
    triggerPlaceholder: string;
    actionPlaceholder: string;
    createButton: string;
    enabled: string;
    paused: string;
    deleteRule: string;
    emptyTitle: string;
    emptySubtitle: string;
    askAssistant: string;
    askAssistantPrompt: string;
  };
  settings: {
    kicker: string;
    title: string;
    subtitle: string;
    languageSectionTitle: string;
    languageLabel: string;
    languageEnglish: string;
    languagePersian: string;
    themeLabel: string;
    dayMode: string;
    nightMode: string;
    autoDetectLabel: string;
    autoDetectDesc: string;
    accountSectionTitle: string;
    accountStatusLabel: string;
    offlineSyncSectionTitle: string;
    connectivityLabel: string;
    pendingCountLabel: string;
    syncButton: string;
    pwaSectionTitle: string;
    pwaStatusLabel: string;
    pwaInstalledLabel: string;
    pwaInstallAvailable: string;
    geminiSectionTitle: string;
    configured: string;
    notConfigured: string;
    checking: string;
    executionMode: string;
    serverSideSdk: string;
    defaultModel: string;
    credentialSource: string;
    secretsPanel: string;
    firebaseSectionTitle: string;
    activeSessionStore: string;
    firestoreWithCache: string;
    plannedCollections: string;
    registryTitle: string;
    totalLabel: string;
    colModule: string;
    colId: string;
    colTools: string;
    colStatus: string;
    conflictsResolvedLabel: string;
    platformSectionTitle: string;
    runtimePlatformLabel: string;
    platformWeb: string;
    platformPwa: string;
    platformIos: string;
    platformAndroid: string;
    platformWindows: string;
    notificationPermLabel: string;
    microphonePermLabel: string;
    permGranted: string;
    permDenied: string;
    permPrompt: string;
    permUnsupported: string;
    enableNotificationsButton: string;
    testNotificationButton: string;
    testNotificationTitle: string;
    testNotificationBody: string;
    notificationSentNotice: string;
    notificationBlockedNotice: string;
    downloadsSectionTitle: string;
    downloadsSectionDesc: string;
    downloadWindowsKit: string;
    downloadAndroidKit: string;
    downloadIosKit: string;
    downloadFullGuide: string;
    windowsGuideTitle: string;
    windowsGuideStep1: string;
    windowsGuideStep2: string;
    androidGuideTitle: string;
    androidGuideStep1: string;
    androidGuideStep2: string;
    iosGuideTitle: string;
    iosGuideStep1: string;
    iosGuideStep2: string;
    nativeCompileNote: string;
    downloadFailedError: string;
    securitySectionTitle: string;
    securitySectionDesc: string;
    connectedFoldersCount: string;
    clipboardPermLabel: string;
    vaultStatusLabel: string;
    vaultUnlockedStatus: string;
    vaultLockedStatus: string;
    deleteConfirmPolicyLabel: string;
    deleteConfirmPolicyDesc: string;
    systemTelemetryTitle: string;
    cpuCoresLabel: string;
    memoryLabel: string;
    storageQuotaLabel: string;
    refreshTelemetry: string;
  };
  research: {
    kicker: string;
    title: string;
    subtitle: string;
    tabSearch: string;
    tabBrowser: string;
    tabDownloads: string;
    tabApps: string;
    queryPlaceholder: string;
    searchButton: string;
    searching: string;
    sourcesTitle: string;
    noSources: string;
    urlPlaceholder: string;
    inspectPromptPlaceholder: string;
    inspectButton: string;
    inspecting: string;
    downloadUrlPlaceholder: string;
    downloadButton: string;
    downloading: string;
    downloadHistoryEmpty: string;
    browserBoundaryNote: string;
    appNamePlaceholder: string;
    appUriPlaceholder: string;
    addAppButton: string;
    launchButton: string;
    appBoundaryNote: string;
    downloadGuideNote: string;
    connectDownloadsTip: string;
    saveCopyButton: string;
    appsGuideTitle: string;
    appsGuideBody: string;
    appsFilterAll: string;
    appsFilterDesktop: string;
    appsFilterWeb: string;
    restoreDefaultsButton: string;
    videoQualityLabel: string;
    qualityBest: string;
    quality720p: string;
    quality480p: string;
    qualityAudio: string;
    youtubeOptionsToggle: string;
    youtubeOptionsDesc: string;
    cookiesUploadButton: string;
    cookiesPlaceholder: string;
    cobaltPlaceholder: string;
    clearCookiesButton: string;
  };
  workbench: {
    kicker: string;
    title: string;
    subtitle: string;
    tabCode: string;
    tabGit: string;
    tabScaffold: string;
    tabTables: string;
    gitPathPlaceholder: string;
    inspectGitButton: string;
    gitBranchLabel: string;
    gitRemotesLabel: string;
    gitCommitsLabel: string;
    projectNamePlaceholder: string;
    templateLabel: string;
    scaffoldButton: string;
    sendCodeToAi: string;
    tableNamePlaceholder: string;
    tableColumnsPlaceholder: string;
    createTableButton: string;
    addRowButton: string;
    exportCsvButton: string;
    noTablesTitle: string;
    noTablesDesc: string;
  };
  hub: {
    kicker: string;
    title: string;
    subtitle: string;
    tabMeetings: string;
    tabFinance: string;
    tabVault: string;
    tabActivity: string;
    recordMeetingStart: string;
    recordMeetingStop: string;
    uploadAudioButton: string;
    transcribingLabel: string;
    transcriptTitle: string;
    decisionsTitle: string;
    actionItemsTitle: string;
    convertActionsToTasks: string;
    saveMeetingDoc: string;
    financeIncome: string;
    financeExpense: string;
    financeAmountPlaceholder: string;
    financeCategoryPlaceholder: string;
    financeNotePlaceholder: string;
    addEntryButton: string;
    totalIncomeLabel: string;
    totalExpenseLabel: string;
    netBalanceLabel: string;
    exportFinanceCsv: string;
    vaultMasterPrompt: string;
    vaultCreatePassPlaceholder: string;
    vaultUnlockPassPlaceholder: string;
    vaultUnlockButton: string;
    vaultLockButton: string;
    vaultLabelPlaceholder: string;
    vaultUserPlaceholder: string;
    vaultSecretPlaceholder: string;
    vaultAddButton: string;
    vaultCopySecret: string;
    vaultZeroPlaintextNote: string;
    activitySearchPlaceholder: string;
    activityEmpty: string;
    statusSuccess: string;
    statusWarning: string;
    statusError: string;
    financeGuideTitle: string;
    financeGuideBody: string;
    budgetLimitsTitle: string;
    budgetCategoryPlaceholder: string;
    budgetLimitPlaceholder: string;
    setBudgetButton: string;
    categoryBreakdownTitle: string;
    savingsRateLabel: string;
    analyzeFinanceAi: string;
    analyzeFinancePrompt: string;
    vaultGuideTitle: string;
    vaultGuideBody: string;
  };
  extras: {
    tabFilesExplorer: string;
    tabMediaOrganizer: string;
    tabBackups: string;
    tabClipboard: string;
    scanMediaButton: string;
    organizeMediaButton: string;
    mediaPhotos: string;
    mediaVideos: string;
    mediaAudio: string;
    mediaDocs: string;
    backupJsonButton: string;
    backupZipButton: string;
    restoreBackupButton: string;
    backupStatusSuccess: string;
    captureClipboardButton: string;
    clipboardPlaceholder: string;
    saveClipboardButton: string;
    copyAction: string;
    tabTasksList: string;
    tabReminders: string;
    tabScheduler: string;
    reminderTitlePlaceholder: string;
    reminderRecurrenceLabel: string;
    recurrenceNone: string;
    recurrenceDaily: string;
    recurrenceWeekly: string;
    recurrenceMonthly: string;
    addReminderButton: string;
    dueAlertBannerPrefix: string;
    generatePlanButton: string;
    savePlanDocButton: string;
    runAutomationNow: string;
    automationRanNotice: string;
  };
  designers: {
    buttonLabel: string;
    modalTitle: string;
    modalSubtitle: string;
    roleLabel: string;
    whatsappLabel: string;
    emailLabel: string;
    closeModal: string;
  };
  notifications: {
    calendarEventTitle: string;
    reminderTitle: string;
    emailSummaryTitle: string;
    notificationDelivered: string;
    openSection: string;
    dismiss: string;
  };
}

export const TRANSLATIONS: Record<AppLanguage, TranslationDictionary> = {
  en: {
    brandName: 'Neuron Mind',
    nav: {
      assistant: 'Assistant',
      tasks: 'Tasks',
      emails: 'Emails',
      files: 'Files',
      calendar: 'Calendar',
      memory: 'Memory',
      automations: 'Automations',
      research: 'Research & Web',
      workbench: 'Dev & Data',
      hub: 'Vault & Finance',
      settings: 'Settings',
      workspaceModules: 'Workspace Modules',
      system: 'System',
      openMenu: 'Open navigation menu',
      closeMenu: 'Close navigation menu',
    },
    topbar: {
      newThread: 'New Thread',
      openAssistant: 'Open Assistant',
      refreshStatus: 'Refresh Status',
      online: 'Online',
      offline: 'Offline',
      pendingSync: 'pending sync',
      syncNow: 'Sync Now',
      syncing: 'Syncing...',
    },
    auth: {
      localWorkspace: 'Local Workspace',
      signInWithGoogle: 'Sign in with Google',
      signOut: 'Sign out',
      signedIn: 'Signed in',
      cloudSyncActive: 'Firestore sync active',
      offlineLocalOnly: 'Local cache · Sign in for cloud sync',
      signInPrompt: 'Sign in with Google to synchronize tasks, calendar, files, memory, and conversations across devices via Firestore.',
      authErrorTitle: 'Authentication error',
      connectWorkspaceQuick: 'Connect Gmail & Calendar',
      workspaceSessionActive: 'Gmail & Calendar active',
      workspaceNeedsRefresh: 'Your Google account is signed in for cloud sync, but Gmail & Calendar permission needs a quick one-click authorization for this browser session.',
    },
    pwa: {
      installApp: 'Install App',
      installOnIOS: 'Install on iOS',
      iosTitle: 'Install Neuron Mind on iPhone / iPad',
      iosStep1: '1. Tap the Share button in your Safari toolbar.',
      iosStep2: '2. Scroll down and select Add to Home Screen.',
      close: 'Close',
      installed: 'Installed as app',
    },
    offline: {
      bannerTitle: 'Offline Mode — Cached data active',
      bannerDetail: 'You can view cached tasks, calendar events, files, and create or edit local tasks. Changes will sync automatically when reconnected.',
      aiUnavailableOffline: 'Offline Local Mode active — create/complete tasks, schedule events, save notes & memories offline (auto-syncs when online). Cloud Gemini AI requires internet.',
      syncFailedPrefix: 'Synchronization failed:',
      syncCompleted: 'All pending offline changes synchronized.',
      queuedLocally: 'Saved locally · Queued for sync',
      lastSynced: 'Last synced',
    },
    chat: {
      threads: 'Threads',
      heroKicker: 'Central AI Agent · Bilingual English & Persian',
      heroSubtitle:
        'One central assistant for tasks, schedules, files, memory, and automations. Write in English, Persian, or both — Neuron Mind responds in your language and runs the same workspace tools.',
      registeredModules: 'Registered Domain Modules',
      modulesCountLabel: 'modules',
      statusConnected: 'Connected',
      statusReady: 'Awaiting OAuth',
      you: 'You',
      assistantName: 'Neuron Mind',
      thinking: 'Neuron Mind is processing...',
      requestErrorTitle: 'Request could not be completed',
      dismiss: 'Dismiss',
      composerLabel: 'Message Neuron Mind',
      composerPlaceholder: 'Ask Neuron Mind in English or فارسی...',
      composerPlaceholderOffline: 'Offline mode — type "Add task ...", "List tasks", or "وظیفه ..." (syncs when online)',
      send: 'Send',
      composerHint: 'Enter to send · Shift + Enter for new line',
      voiceStart: 'Start voice input',
      voiceStop: 'Stop voice input',
      voiceListening: 'Listening... click mic to stop',
      voiceTranscribing: 'Transcribing voice...',
      voiceUnsupported: 'Voice input is not supported in this browser.',
      voiceError: 'Could not capture voice input.',
      emptyPromptTitle: "What's on your mind today?",
      geminiKeyTitle: 'Server Gemini API key is not configured yet',
      geminiKeyBody:
        'Neuron Mind routes all inference through the Node.js backend. Add GEMINI_API_KEY in Settings > Secrets to enable live responses.',
      starterPrompt1: 'Organize my tasks for tomorrow and check my emails.',
      starterPrompt2: 'وظایف فردایم را تنظیم کن و یک برنامه کاری مرتب بساز.',
      starterPrompt3: 'Summarize my stored memories and upcoming calendar events.',
      toolExecutedPrefix: 'Tools executed:',
      runningComputerTools: 'Accessing connected computer folders...',
      computerFoldersLabel: 'Computer folders:',
      connectFolderQuick: 'Connect Folder',
      noFoldersQuick: 'None connected',
      deleteConfirmTitle: 'Confirm Delete on Your Computer',
      deleteConfirmBody: 'Neuron Mind is requesting permission to permanently delete the following item(s) from your connected computer folder:',
      deleteConfirmProceed: 'Delete from Computer',
      deleteConfirmCancel: 'Cancel',
      captureScreen: 'Capture Screen',
      attachFileOrImage: 'Attach Image / File',
      attachmentsLabel: 'Attached context:',
      removeAttachment: 'Remove attachment',
      speakReply: 'Read aloud',
      stopSpeaking: 'Stop audio',
      newChat: 'New Chat',
      plugins: 'Plugins',
      explore: 'Explore',
      searchChatsPlaceholder: 'Search chat history...',
      historyToday: 'Today',
      historyWeek: 'Previous 7 Days',
      historyOlder: 'Older',
      noMatchingChats: 'No matching chats in history.',
      toggleHistory: 'Chat history',
      deleteChat: 'Delete chat',
      backToChat: 'Back to Chat',
      exploreTitle: 'Explore Capabilities',
      exploreSubtitle: 'Browse Neuron Mind skills across desktop files, productivity, web research, code, finance, and voice — click any prompt to launch it.',
      pluginsTitle: 'Connected Plugins & Tools',
      pluginsSubtitle: 'Live modules wired to your central AI agent. Connect optional accounts or folders directly from here.',
      pluginActive: 'Connected',
      pluginNeedsConnect: 'Connect on use',
      openModule: 'Open',
      tryPrompt: 'Try in Chat',
    },
    tasks: {
      kicker: 'Language-Independent Task Workspace',
      title: 'Tasks',
      subtitle:
        'Create and manage tasks in English or Persian. Every task is stored in structured form and remains accessible across both languages, online and offline.',
      addPlaceholder: 'Add a task in English or فارسی...',
      dueDateLabel: 'Due date',
      priorityLabel: 'Priority',
      priorityLow: 'Low',
      priorityMedium: 'Medium',
      priorityHigh: 'High',
      addButton: 'Add Task',
      searchPlaceholder: 'Search tasks in any language...',
      filterAll: 'All',
      filterOpen: 'Open',
      filterCompleted: 'Completed',
      emptyTitle: 'No matching tasks',
      emptySubtitle: 'Add a task above or ask Neuron Mind to create tasks from natural language.',
      markDone: 'Complete',
      reopen: 'Reopen',
      editTask: 'Edit',
      saveEdit: 'Save',
      cancelEdit: 'Cancel',
      deleteTask: 'Delete',
      sourceLabel: 'Created in',
      originalTextLabel: 'Original input',
      statusTodo: 'Open',
      statusInProgress: 'In Progress',
      statusCompleted: 'Completed',
      askAssistant: 'Plan Tasks with Neuron Mind',
      askAssistantPrompt: 'Review my open tasks and help me prioritize them for tomorrow.',
    },
    calendar: {
      kicker: 'Synchronized Schedule & Events',
      title: 'Calendar',
      subtitle:
        'View previously synchronized events offline and schedule new events directly or through Neuron Mind in English or Persian.',
      eventTitlePlaceholder: 'Event title (English or فارسی)...',
      startTimeLabel: 'Date & time',
      locationPlaceholder: 'Location or link (optional)',
      addButton: 'Add Event',
      emptyTitle: 'No calendar events yet',
      emptySubtitle: 'Create an event above or ask Neuron Mind to schedule a meeting.',
      deleteEvent: 'Delete',
      askAssistant: 'Plan Schedule with Neuron Mind',
      askAssistantPrompt: 'Review my upcoming calendar events and suggest focus blocks.',
      connectGoogleCalendar: 'Connect Google Calendar',
      pullGoogleEvents: 'Sync Google Calendar',
      syncingGoogle: 'Syncing...',
      pushToGoogleLabel: 'Also add to Google Calendar',
      googleConnectedNotice: 'Google Calendar session active',
      googlePullSuccess: 'Synced events from Google Calendar.',
      googleDeleteConfirmTitle: 'Delete Event from Google Calendar',
      googleDeleteConfirmBody: 'Remove this event from your workspace and Google Calendar?',
      googleDeleteCancel: 'Cancel',
      googleDeleteProceed: 'Delete Event',
      quickTestOneMin: '+1 min alert',
      scheduledActionLabel: 'Optional Action at Event Time',
      actionNone: 'Notification only (no automated task)',
      actionCreateFolder: 'Create folder in connected PC directory',
      actionDownloadUrl: 'Download pasted file/media link to Downloads',
      actionCreateTask: 'Create a prioritized task at event time',
      actionCreateDocument: 'Create a workspace document note',
      actionFolderPlaceholder: 'Folder path (e.g. Meetings/Project-Review)',
      actionUrlPlaceholder: 'Direct file, image, or video link (https://...)',
      actionTaskPlaceholder: 'Task title to create when event arrives...',
      actionDocPlaceholder: 'Document title to save when event arrives...',
      eventAlertBannerPrefix: 'Calendar Event Due:',
      actionStatusPending: 'Scheduled',
      actionStatusExecuted: 'Completed',
      actionStatusFailed: 'Failed',
    },
    files: {
      kicker: 'Workspace Documents & Offline Cache',
      title: 'Files',
      subtitle:
        'Create notes and AI-generated reports, search across languages, and keep important documents cached for offline reading.',
      docTitlePlaceholder: 'Document title...',
      folderPlaceholder: 'Folder (e.g. Notes, Reports)',
      contentPlaceholder: 'Document content...',
      saveButton: 'Save Document',
      searchPlaceholder: 'Search documents...',
      cachedOfflineLabel: 'Available offline',
      toggleOfflineCache: 'Offline cache',
      deleteDoc: 'Delete',
      emptyTitle: 'No documents saved yet',
      emptySubtitle: 'Save a note above or ask Neuron Mind to draft and store a report.',
      askAssistant: 'Draft Document with Neuron Mind',
      askAssistantPrompt: 'Create a structured summary document of my current tasks and schedule.',
      importFile: 'Import File',
      exportFile: 'Export',
      importedFolderLabel: 'Imported',
      fileActionError: 'Unable to complete the file operation on this device.',
      computerSectionTitle: 'Computer Folders & Local Disk Access',
      computerSectionDesc: 'Connect real folders on your PC (Desktop, Documents, Downloads, or project folders) so Neuron Mind can list, read, create, organize, rename, move, and search files directly.',
      connectComputerFolder: 'Connect Computer Folder',
      noComputerFolders: 'No computer folders connected yet. Click "Connect Computer Folder" to grant Neuron Mind permission to manage a real folder on your PC.',
      iframeBlockedNote: 'Direct folder picker is restricted inside embedded preview frames. Open Neuron Mind in your installed Desktop App or standalone Edge/Chrome window to connect computer folders.',
      unsupportedFolderPickerNote: 'This browser does not support File System Access folder picking. Use Microsoft Edge or Google Chrome (or the Neuron Mind Windows Desktop App).',
      folderPermissionGranted: 'Read & Write active',
      folderPermissionPrompt: 'Permission needed',
      reconnectFolder: 'Reconnect',
      disconnectFolder: 'Disconnect',
      refreshFolder: 'Refresh',
      askAgentFolder: 'Manage with AI',
      askAgentFolderPromptPrefix: 'Inspect and organize the files in my connected computer folder:',
      newSubfolderPlaceholder: 'New folder name...',
      createSubfolderButton: 'New Folder',
      newPcFilePlaceholder: 'New file name (e.g. notes.txt)...',
      newPcFileContentPlaceholder: 'File content...',
      createPcFileButton: 'Write File',
      searchPcPlaceholder: 'Search inside connected folder...',
      upOneLevel: 'Up',
      rootLevel: 'Root',
      itemsLabel: 'items',
      openFolderAction: 'Open',
      viewFileAction: 'Read / Edit',
      renameAction: 'Rename',
      renamePlaceholder: 'New name...',
      saveRename: 'Save',
      deletePcEntryAction: 'Delete',
      emptyFolderNotice: 'This folder is empty.',
      filePreviewTitle: 'Computer File Editor',
      saveFileChanges: 'Save to Disk',
      closePreview: 'Close',
    },
    emails: {
      kicker: 'External Mailbox Integration',
      title: 'Emails',
      subtitle:
        'Email triage, summarization, and draft preparation through Neuron Mind once an external mailbox is connected.',
      noAccountTitle: 'Connect your Gmail & Google Calendar',
      noAccountBody:
        'Authorize your Google Account to read, draft, and send real Gmail messages and sync Google Calendar events directly inside Neuron Mind.',
      capabilitiesTitle: 'Connected Capabilities',
      cap1Title: 'Multilingual inbox & AI summaries',
      cap1Desc: 'Read and summarize incoming English and Persian threads into clear action items.',
      cap2Title: 'Draft preparation & confirmed sending',
      cap2Desc: 'Save Gmail drafts or send replies only after your explicit confirmation.',
      nextStepsTitle: 'Step-by-Step Connection Guide',
      step1: 'Click "Connect Gmail & Calendar" above and allow browser pop-ups if prompted.',
      step2: 'If Google displays "Google hasn’t verified this app", click Advanced → Continue.',
      step3: 'On the Google permission screen, check ALL boxes ("Select all") for Gmail and Google Calendar, then click Continue.',
      step4: 'Access tokens stay in memory only for security; after a page reload or ~1 hour, click Reconnect anytime to refresh.',
      askAssistant: 'Discuss Emails with Neuron Mind',
      askAssistantPrompt: 'Check my inbox, summarize urgent unread messages, and help me reply.',
      connectButton: 'Connect Gmail & Calendar',
      reconnectButton: 'Reconnect Google Session',
      connectedAsLabel: 'Gmail session active:',
      refreshInbox: 'Refresh Inbox',
      searchPlaceholder: 'Search Gmail (e.g. from:alice or is:unread)...',
      searchButton: 'Search',
      composeButton: 'Compose',
      summarizeInboxAi: 'Summarize Inbox with AI',
      loadingInbox: 'Loading Gmail inbox...',
      emptyInbox: 'No matching Gmail messages found.',
      selectMessagePrompt: 'Select an email to read, summarize, or reply.',
      fromLabel: 'From',
      toLabel: 'To',
      dateLabel: 'Date',
      subjectLabel: 'Subject',
      bodyLabel: 'Message',
      replyButton: 'Reply',
      summarizeMessageAi: 'Summarize with AI',
      draftReplyAi: 'Draft Reply with AI',
      saveDraftButton: 'Save Gmail Draft',
      sendEmailButton: 'Send Email',
      closeCompose: 'Cancel',
      draftSavedNotice: 'Draft saved in your Gmail Drafts folder.',
      emailSentNotice: 'Email sent via Gmail.',
      sendConfirmTitle: 'Confirm Send Email',
      sendConfirmBody: 'Review recipient and subject carefully before sending this email from your Gmail account:',
      sendConfirmCancel: 'Cancel',
      sendConfirmProceed: 'Confirm & Send',
      offlineNotice: 'Gmail requires an internet connection. Offline draft writing and cached tasks remain available.',
      unreadLabel: 'Unread',
      dailySummaryTitle: 'Daily 8:00 PM Important Emails Summary',
      dailySummarySubtitle: 'Automatically scans your connected mailbox every day by 8:00 PM, summarizes important emails, and writes a clear conclusion.',
      dailySummaryScheduleBadge: 'Auto-scheduled daily · 8:00 PM',
      summarizeImportantNow: 'Summarize Important Emails Now',
      summarizingImportant: 'Analyzing important emails...',
      dailyConclusionLabel: 'Daily Conclusion & Action Plan',
      noImportantEmails: 'No urgent or high-priority emails were found in the scanned messages.',
      importantCountLabel: 'important',
      scannedCountLabel: 'scanned',
      rememberedConnectionTitle: 'Saved Gmail Connection',
      rememberedConnectionBody: 'Your email account stays remembered across sessions. Refresh the live Gmail session whenever you want to fetch new mail or send an email.',
      refreshLiveSession: 'Refresh Live Session',
      apiDisabledTitle: 'Enable Gmail & Calendar API in Google Cloud Console (One-Time Setup)',
      apiDisabledBody: 'Your Google login worked, but Gmail API or Google Calendar API is not yet enabled on Google Cloud project 1022597897742. Click the links below to enable them, wait ~1–2 minutes for Google propagation, then click Retry.',
      enableGmailApi: 'Enable Gmail API',
      enableCalendarApi: 'Enable Calendar API',
      retryConnection: 'Retry Connection',
      validationToRequired: 'Please enter a recipient email address in the To field.',
      sendingStatus: 'Sending...',
      disconnectMailbox: 'Disconnect',
    },
    memory: {
      kicker: 'Persistent Bilingual Context',
      title: 'Memory',
      subtitle:
        'Store personal preferences, context, and workflows remembered by Neuron Mind across both English and Persian conversations.',
      factPlaceholder: 'Remember that I prefer concise morning briefings...',
      categoryPreference: 'Preference',
      categoryContext: 'Context',
      categoryWorkflow: 'Workflow',
      saveButton: 'Save Memory',
      searchPlaceholder: 'Search memories...',
      deleteMemory: 'Delete',
      emptyTitle: 'No memories stored yet',
      emptySubtitle: 'Add a preference above or tell Neuron Mind what to remember.',
      askAssistant: 'Review Memory with Neuron Mind',
      askAssistantPrompt: 'Summarize what you currently remember about my preferences and workflows.',
    },
    automations: {
      kicker: 'Rules & Scheduled Briefings',
      title: 'Automations',
      subtitle:
        'Define recurring routines and reminders that coordinate Neuron Mind modules safely.',
      namePlaceholder: 'Automation name...',
      triggerPlaceholder: 'Trigger (e.g. Every weekday at 08:30)',
      actionPlaceholder: 'Action summary...',
      createButton: 'Create Rule',
      enabled: 'Enabled',
      paused: 'Paused',
      deleteRule: 'Delete',
      emptyTitle: 'No automations configured yet',
      emptySubtitle: 'Create a rule above or ask Neuron Mind to set up a reminder.',
      askAssistant: 'Design Automation with Neuron Mind',
      askAssistantPrompt: 'Design a morning briefing automation combining my tasks and calendar.',
    },
    settings: {
      kicker: 'System Architecture · Bilingual, Offline & Cloud Sync',
      title: 'Settings',
      subtitle:
        'Configure interface language, automatic language detection, Firebase cloud synchronization, PWA installation, and server-side AI readiness.',
      languageSectionTitle: 'Language & Direction',
      languageLabel: 'Interface Language',
      languageEnglish: 'English (LTR)',
      languagePersian: 'فارسی / Persian (RTL)',
      themeLabel: 'Appearance',
      dayMode: 'Day',
      nightMode: 'Night',
      autoDetectLabel: 'Automatic Message Language Detection',
      autoDetectDesc: 'Automatically adapt interface direction when you send messages in Persian or English.',
      accountSectionTitle: 'Account & Cloud Sync (Firebase)',
      accountStatusLabel: 'Authentication Status',
      offlineSyncSectionTitle: 'Offline Cache & Synchronization',
      connectivityLabel: 'Connectivity',
      pendingCountLabel: 'Queued Offline Changes',
      syncButton: 'Sync Pending Changes',
      pwaSectionTitle: 'Mobile & App Installation (PWA)',
      pwaStatusLabel: 'Install Readiness',
      pwaInstalledLabel: 'Running as installed app',
      pwaInstallAvailable: 'Ready to install on this device',
      geminiSectionTitle: 'Gemini AI Backend',
      configured: 'Configured',
      notConfigured: 'Key not set',
      checking: 'Checking...',
      executionMode: 'Execution Mode',
      serverSideSdk: 'Server-side SDK',
      defaultModel: 'Default Model',
      credentialSource: 'Credential Source',
      secretsPanel: 'Settings > Secrets',
      firebaseSectionTitle: 'Firestore Persistence',
      activeSessionStore: 'Storage Mode',
      firestoreWithCache: 'Firestore + Local Offline Cache',
      plannedCollections: 'Collections',
      registryTitle: 'Registered Tool Registry',
      totalLabel: 'total',
      colModule: 'Module',
      colId: 'Registry ID',
      colTools: 'Tools',
      colStatus: 'Status',
      conflictsResolvedLabel: 'Sync Conflicts Preserved',
      platformSectionTitle: 'Cross-Platform Runtime & Permissions',
      runtimePlatformLabel: 'Active Shell / Platform',
      platformWeb: 'Web Browser',
      platformPwa: 'Installed PWA',
      platformIos: 'iOS App (Capacitor)',
      platformAndroid: 'Android App (Capacitor)',
      platformWindows: 'Windows Desktop (Tauri)',
      notificationPermLabel: 'Notifications',
      microphonePermLabel: 'Microphone',
      permGranted: 'Granted',
      permDenied: 'Denied',
      permPrompt: 'Prompt on use',
      permUnsupported: 'Unavailable',
      enableNotificationsButton: 'Enable Notifications',
      testNotificationButton: 'Send Test Notification',
      testNotificationTitle: 'Neuron Mind Notification Ready',
      testNotificationBody: 'Cross-platform alerts are active on this device.',
      notificationSentNotice: 'Notification delivered.',
      notificationBlockedNotice: 'Notification permission is blocked or unavailable in this environment.',
      downloadsSectionTitle: 'Downloadable Kits & Installation Guide (Windows · Android · iOS)',
      downloadsSectionDesc: 'Install immediately as an offline-capable app on all three platforms, or download the native packaging kits (.msi/.exe, .apk/.aab, .ipa) and complete step-by-step instructions.',
      downloadWindowsKit: 'Windows Kit (.zip)',
      downloadAndroidKit: 'Android Kit (.zip)',
      downloadIosKit: 'iOS Kit (.zip)',
      downloadFullGuide: 'Full Install Guide (.md)',
      windowsGuideTitle: 'Windows 10 & 11',
      windowsGuideStep1: '1-Click Desktop App: Extract Windows Kit (.zip) and double-click Install-Neuron-Mind.cmd (installs offline app bundle, Desktop/Start Menu shortcuts & Add/Remove Programs entry), or click Install App in Edge/Chrome.',
      windowsGuideStep2: 'Run portable offline: Double-click Launch-Offline-Now.cmd inside the zip. Optional Tauri .msi/.exe source is also inside native-tauri-source/.',
      androidGuideTitle: 'Android Phones & Tablets',
      androidGuideStep1: 'Instant offline app: Open in Chrome and tap Install App / Add to Home Screen.',
      androidGuideStep2: 'Native .apk/.aab: Run scripts/build-android.sh with Android Studio + JDK 17, or trigger GitHub Actions.',
      iosGuideTitle: 'iPhone & iPad (iOS)',
      iosGuideStep1: 'Instant offline app: Open in Safari, tap Share, then Add to Home Screen.',
      iosGuideStep2: 'Native .ipa / App Store: Run scripts/build-ios.sh on macOS with Xcode 15+, or use GitHub Actions.',
      nativeCompileNote: 'Signed .exe/.msi, .apk/.aab, and .ipa binaries require Windows/Android/macOS compilers or the included GitHub Actions CI workflow.',
      downloadFailedError: 'Unable to download the package right now. Ensure you are online and try again.',
      securitySectionTitle: 'Security Manager & System Hardware',
      securitySectionDesc: 'Review active device permissions, connected PC folder authorizations, encrypted Credential Vault lock state, and real hardware telemetry.',
      connectedFoldersCount: 'Connected PC Folders',
      clipboardPermLabel: 'Clipboard API',
      vaultStatusLabel: 'Credential Vault (AES-256-GCM)',
      vaultUnlockedStatus: 'Unlocked in session memory',
      vaultLockedStatus: 'Locked (encrypted at rest)',
      deleteConfirmPolicyLabel: 'Require Explicit Delete Confirmation',
      deleteConfirmPolicyDesc: 'Always show a modal prompt before any file or folder is deleted from your computer.',
      systemTelemetryTitle: 'Live Device & Server Telemetry',
      cpuCoresLabel: 'CPU Cores (Client / Server)',
      memoryLabel: 'Memory',
      storageQuotaLabel: 'Browser Storage Quota',
      refreshTelemetry: 'Refresh Telemetry',
    },
    research: {
      kicker: 'Live Internet Grounding · Webpage Reader · Safe Downloads · Launcher',
      title: 'Research & Web',
      subtitle: 'Search the live web with source citations, inspect public webpages, download permitted files to your computer, and launch authorized apps or links.',
      tabSearch: 'Internet Search',
      tabBrowser: 'Webpage Inspector',
      tabDownloads: 'Download Manager',
      tabApps: 'App Launcher',
      queryPlaceholder: 'Search query in English or فارسی...',
      searchButton: 'Search Web',
      searching: 'Searching live sources...',
      sourcesTitle: 'Verified Sources',
      noSources: 'No external source links returned.',
      urlPlaceholder: 'https://example.com/article',
      inspectPromptPlaceholder: 'What should Neuron Mind extract or summarize from this page?',
      inspectButton: 'Read & Analyze URL',
      inspecting: 'Inspecting webpage...',
      downloadUrlPlaceholder: 'https://www.youtube.com/watch?v=... or file URL',
      downloadButton: 'Download Safely',
      downloading: 'Downloading...',
      downloadHistoryEmpty: 'No downloads yet.',
      browserBoundaryNote: 'Browser security prevents controlling external third-party tabs directly; URL Inspection reads permitted public pages safely on the server.',
      appNamePlaceholder: 'App or Site Name',
      appUriPlaceholder: 'URI (e.g. vscode://file, ms-settings:, https://...)',
      addAppButton: 'Authorize Link',
      launchButton: 'Launch',
      appBoundaryNote: 'Web/Desktop browser security allows opening registered URI schemes on click; force-closing third-party OS apps requires native Tauri permissions.',
      downloadGuideNote: 'Paste a direct file URL (.mp4, .mp3, .png, .jpg, .pdf, .zip) or a public media page link. Connect a PC folder in Files to write files straight into your Downloads directory.',
      connectDownloadsTip: 'Connect PC Downloads Folder',
      saveCopyButton: 'Save Copy',
      appsGuideTitle: 'How App Launcher & Authorize Link Work',
      appsGuideBody: '1) Click Launch on any suggested desktop app or web site to open it with one click. 2) To authorize your own app or site, enter a label and a URI: use https://... for websites, vscode://file for VS Code, ms-settings: for Windows Settings, mailto: for Mail, or tg:// / spotify: / calculator: for installed desktop apps.',
      appsFilterAll: 'All',
      appsFilterDesktop: 'Desktop Apps',
      appsFilterWeb: 'Web Sites',
      restoreDefaultsButton: 'Load All Suggestions',
      videoQualityLabel: 'Video Quality',
      qualityBest: 'Best Full Video (MP4)',
      quality720p: '720p HD Video (MP4)',
      quality480p: '480p Video (MP4)',
      qualityAudio: 'Audio Only (MP3)',
      youtubeOptionsToggle: 'YouTube Session Options (if YouTube asks for bot check)',
      youtubeOptionsDesc: 'YouTube links extract the full MP4 video (up to 500 MB) instead of the cover thumbnail. If YouTube blocks the cloud server IP with bot verification, upload or paste your browser cookies.txt (kept only in memory) or provide a Cobalt API URL.',
      cookiesUploadButton: 'Load cookies.txt',
      cookiesPlaceholder: 'Optional: paste Netscape cookies.txt content here...',
      cobaltPlaceholder: 'Optional: Cobalt API URL (e.g. https://your-cobalt-server)',
      clearCookiesButton: 'Clear Session Cookies',
    },
    workbench: {
      kicker: 'Code · Git Metadata · Project Builder · Personal Database',
      title: 'Dev & Data Workbench',
      subtitle: 'Create starter software projects, inspect Git repository metadata in connected folders, send code to AI, and manage structured CSV/JSON database tables.',
      tabCode: 'Code & AI Helper',
      tabGit: 'Git Inspector',
      tabScaffold: 'Project Builder',
      tabTables: 'Database Tables',
      gitPathPlaceholder: 'Subfolder path (optional, e.g. my-repo)',
      inspectGitButton: 'Inspect .git Metadata',
      gitBranchLabel: 'Current Branch',
      gitRemotesLabel: 'Remotes',
      gitCommitsLabel: 'Recent Commits',
      projectNamePlaceholder: 'Project name (e.g. invoice-api)',
      templateLabel: 'Starter Template',
      scaffoldButton: 'Create Project Files',
      sendCodeToAi: 'Ask AI to Explain / Debug',
      tableNamePlaceholder: 'Table name (e.g. Clients)',
      tableColumnsPlaceholder: 'Columns comma-separated (e.g. Name, Email, Status)',
      createTableButton: 'Create Table',
      addRowButton: 'Add Row',
      exportCsvButton: 'Export CSV',
      noTablesTitle: 'No structured tables yet',
      noTablesDesc: 'Create a custom database table above or ask Neuron Mind to create and query one.',
    },
    hub: {
      kicker: 'Meeting Audio · Finance · Encrypted Vault · Audit Trail',
      title: 'Vault, Finance & Meetings',
      subtitle: 'Transcribe meetings into tasks, track income and expenses, guard secrets in a zero-plaintext AES-GCM vault, and review full activity history.',
      tabMeetings: 'Meetings Audio',
      tabFinance: 'Financial Manager',
      tabVault: 'Credential Vault',
      tabActivity: 'Activity History',
      recordMeetingStart: 'Record Microphone',
      recordMeetingStop: 'Stop & Transcribe',
      uploadAudioButton: 'Upload Audio File',
      transcribingLabel: 'Transcribing and extracting decisions...',
      transcriptTitle: 'Transcript',
      decisionsTitle: 'Decisions',
      actionItemsTitle: 'Extracted Action Items',
      convertActionsToTasks: 'Create Tasks from Action Items',
      saveMeetingDoc: 'Save Notes to Files',
      financeIncome: 'Income',
      financeExpense: 'Expense',
      financeAmountPlaceholder: 'Amount',
      financeCategoryPlaceholder: 'Category (e.g. Salary, Groceries)',
      financeNotePlaceholder: 'Note...',
      addEntryButton: 'Add Entry',
      totalIncomeLabel: 'Total Income',
      totalExpenseLabel: 'Total Expenses',
      netBalanceLabel: 'Net Balance',
      exportFinanceCsv: 'Export CSV',
      vaultMasterPrompt: 'Create or enter your master passphrase to unlock your AES-256-GCM local vault. Secrets are never stored in plaintext or sent to AI.',
      vaultCreatePassPlaceholder: 'New master passphrase (min 4 chars)',
      vaultUnlockPassPlaceholder: 'Enter master passphrase',
      vaultUnlockButton: 'Unlock Vault',
      vaultLockButton: 'Lock Vault',
      vaultLabelPlaceholder: 'Service name (e.g. GitHub)',
      vaultUserPlaceholder: 'Username / email',
      vaultSecretPlaceholder: 'Password or token',
      vaultAddButton: 'Encrypt & Store',
      vaultCopySecret: 'Copy Secret',
      vaultZeroPlaintextNote: 'Encrypted locally with PBKDF2 + AES-256-GCM. Passphrase is never saved.',
      activitySearchPlaceholder: 'Search activity logs...',
      activityEmpty: 'No recorded activity yet.',
      statusSuccess: 'Success',
      statusWarning: 'Warning',
      statusError: 'Error',
      financeGuideTitle: 'What Financial Manager Does',
      financeGuideBody: 'Track multi-currency income and expenses (USD, IRR, EUR), set monthly spending limits per category, monitor category breakdowns and savings rate, export CSV ledgers, or ask Neuron Mind AI to analyze your budget.',
      budgetLimitsTitle: 'Monthly Category Budgets',
      budgetCategoryPlaceholder: 'Category (e.g. Groceries)',
      budgetLimitPlaceholder: 'Monthly limit',
      setBudgetButton: 'Set Budget Limit',
      categoryBreakdownTitle: 'Spending by Category',
      savingsRateLabel: 'Savings Rate',
      analyzeFinanceAi: 'Analyze Finances with AI',
      analyzeFinancePrompt: 'Analyze my recorded income, expenses, and category totals, and give practical budget advice.',
      vaultGuideTitle: 'What Credential Vault Does & How It Protects You',
      vaultGuideBody: 'Store sensitive passwords, API tokens, recovery keys, and Wi-Fi PINs inside an encrypted local safe. Every secret is encrypted in your browser using PBKDF2 key derivation and AES-256-GCM before being saved—neither your master passphrase nor decrypted secrets are ever sent to servers or AI models.',
    },
    extras: {
      tabFilesExplorer: 'Files & Folders',
      tabMediaOrganizer: 'Media Organizer',
      tabBackups: 'Backups & Restore',
      tabClipboard: 'Clipboard History',
      scanMediaButton: 'Scan Connected Folder Media',
      organizeMediaButton: 'Organize into Photos / Videos / Audio / Docs',
      mediaPhotos: 'Photos',
      mediaVideos: 'Videos',
      mediaAudio: 'Audio',
      mediaDocs: 'Documents',
      backupJsonButton: 'Create Verified JSON Backup',
      backupZipButton: 'Download ZIP Archive Backup',
      restoreBackupButton: 'Verify & Restore Backup (.json)',
      backupStatusSuccess: 'Backup created & verified',
      captureClipboardButton: 'Capture from Clipboard',
      clipboardPlaceholder: 'Save a snippet to clipboard history...',
      saveClipboardButton: 'Save Snippet',
      copyAction: 'Copy',
      tabTasksList: 'Tasks Queue',
      tabReminders: 'Reminders',
      tabScheduler: 'Daily Plan & Scheduler',
      reminderTitlePlaceholder: 'Reminder title (English or فارسی)...',
      reminderRecurrenceLabel: 'Repeat',
      recurrenceNone: 'One-time',
      recurrenceDaily: 'Daily',
      recurrenceWeekly: 'Weekly',
      recurrenceMonthly: 'Monthly',
      addReminderButton: 'Set Reminder',
      dueAlertBannerPrefix: 'Reminder Due:',
      generatePlanButton: 'Generate Smart Daily Plan',
      savePlanDocButton: 'Save Plan as Document',
      runAutomationNow: 'Run Now',
      automationRanNotice: 'Automation executed and logged.',
    },
    designers: {
      buttonLabel: 'Designers',
      modalTitle: 'System Designers',
      modalSubtitle: 'Designed and engineered for Neuron Mind. Contact either system designer directly via WhatsApp or Email.',
      roleLabel: 'System Designer',
      whatsappLabel: 'WhatsApp',
      emailLabel: 'Email',
      closeModal: 'Close',
    },
    notifications: {
      calendarEventTitle: 'Calendar Event',
      reminderTitle: 'Reminder Due',
      emailSummaryTitle: 'Daily 8:00 PM Email Summary',
      notificationDelivered: 'Notification delivered',
      openSection: 'Open',
      dismiss: 'Dismiss',
    },
  },
  fa: {
    brandName: 'نورون مایند',
    nav: {
      assistant: 'دستیار هوشمند',
      tasks: 'وظایف',
      emails: 'ایمیل‌ها',
      files: 'فایل‌ها',
      calendar: 'تقویم',
      memory: 'حافظه',
      automations: 'خودکارسازی',
      research: 'تحقیق و وب',
      workbench: 'کد و پایگاه‌داده',
      hub: 'گاوصندوق و مالی',
      settings: 'تنظیمات',
      workspaceModules: 'ماژول‌های کاری',
      system: 'سیستم',
      openMenu: 'باز کردن منوی ناوبری',
      closeMenu: 'بستن منوی ناوبری',
    },
    topbar: {
      newThread: 'گفتگوی جدید',
      openAssistant: 'باز کردن دستیار',
      refreshStatus: 'بروزرسانی وضعیت',
      online: 'آنلاین',
      offline: 'آفلاین',
      pendingSync: 'در انتظار همگام‌سازی',
      syncNow: 'همگام‌سازی',
      syncing: 'در حال همگام‌سازی...',
    },
    auth: {
      localWorkspace: 'فضای کاری محلی',
      signInWithGoogle: 'ورود با گوگل',
      signOut: 'خروج',
      signedIn: 'وارد شده',
      cloudSyncActive: 'همگام‌سازی Firestore فعال است',
      offlineLocalOnly: 'حافظه محلی · برای همگام‌سازی ابری وارد شوید',
      signInPrompt: 'برای همگام‌سازی وظایف، تقویم، فایل‌ها، حافظه و گفتگوها بین دستگاه‌ها از طریق Firestore با حساب گوگل وارد شوید.',
      authErrorTitle: 'خطای احراز هویت',
      connectWorkspaceQuick: 'اتصال جیمیل و تقویم',
      workspaceSessionActive: 'جیمیل و تقویم فعال است',
      workspaceNeedsRefresh: 'حساب گوگل شما برای همگام‌سازی متصل است، اما دسترسی جیمیل و تقویم در این نشست مرورگر نیازمند یک کلیک تایید است.',
    },
    pwa: {
      installApp: 'نصب برنامه',
      installOnIOS: 'نصب در آیفون / آیپد',
      iosTitle: 'نصب نورون مایند در iOS',
      iosStep1: '۱. دکمه Share را در نوار ابزار سافاری لمس کنید.',
      iosStep2: '۲. به پایین بروید و گزینه Add to Home Screen را انتخاب کنید.',
      close: 'بستن',
      installed: 'به‌عنوان برنامه نصب شده',
    },
    offline: {
      bannerTitle: 'حالت آفلاین — نمایش داده‌های ذخیره‌شده',
      bannerDetail: 'می‌توانید وظایف، رویدادهای تقویم و فایل‌های ذخیره‌شده را ببینید و وظایف جدید ثبت یا ویرایش کنید. تغییرات پس از اتصال به‌صورت خودکار همگام‌سازی می‌شوند.',
      aiUnavailableOffline: 'حالت آفلاین محلی فعال است — می‌توانید وظایف، رویدادها، یادداشت‌ها و حافظه را بدون اینترنت ثبت و مدیریت کنید (همگام‌سازی خودکار هنگام اتصال). هوش مصنوعی ابری Gemini نیازمند اینترنت است.',
      syncFailedPrefix: 'خطا در همگام‌سازی:',
      syncCompleted: 'تمام تغییرات آفلاین با موفقیت همگام‌سازی شدند.',
      queuedLocally: 'ذخیره محلی · در صف همگام‌سازی',
      lastSynced: 'آخرین همگام‌سازی',
    },
    chat: {
      threads: 'گفتگوها',
      heroKicker: 'دستیار هوشمند مرکزی · دوزبانه فارسی و انگلیسی',
      heroSubtitle:
        'یک دستیار یکپارچه برای مدیریت وظایف، زمان‌بندی، فایل‌ها، حافظه و خودکارسازی. به فارسی یا انگلیسی بنویسید — نورون مایند با زبان شما پاسخ می‌دهد و همان ابزارها را اجرا می‌کند.',
      registeredModules: 'ماژول‌های ثبت‌شده',
      modulesCountLabel: 'ماژول',
      statusConnected: 'متصل',
      statusReady: 'در انتظار اتصال',
      you: 'شما',
      assistantName: 'نورون مایند',
      thinking: 'نورون مایند در حال پردازش است...',
      requestErrorTitle: 'درخواست انجام نشد',
      dismiss: 'بستن',
      composerLabel: 'پیام به نورون مایند',
      composerPlaceholder: 'پیام خود را به فارسی یا English بنویسید...',
      composerPlaceholderOffline: 'حالت آفلاین — بنویسید «وظیفه جدید ...»، «لیست وظایف» یا دستور انگلیسی بدهید',
      send: 'ارسال',
      composerHint: 'Enter برای ارسال · Shift + Enter برای خط جدید',
      voiceStart: 'شروع ورودی صوتی',
      voiceStop: 'توقف ضبط صدا',
      voiceListening: 'در حال شنیدن... برای توقف روی میکروفون بزنید',
      voiceTranscribing: 'در حال تبدیل صدا به متن...',
      voiceUnsupported: 'ورودی صوتی در این مرورگر پشتیبانی نمی‌شود.',
      voiceError: 'دریافت ورودی صوتی با خطا مواجه شد.',
      emptyPromptTitle: 'امروز چه چیزی در ذهن دارید؟',
      geminiKeyTitle: 'کلید سرور Gemini API هنوز تنظیم نشده است',
      geminiKeyBody:
        'نورون مایند تمام پردازش‌ها را در سرور Node.js انجام می‌دهد. برای فعال‌سازی پاسخ‌ها، GEMINI_API_KEY را در Settings > Secrets قرار دهید.',
      starterPrompt1: 'وظایف فردایم را تنظیم کن و ایمیلهایم را بررسی کن.',
      starterPrompt2: 'Organize my tasks for tomorrow and check my emails.',
      starterPrompt3: 'حافظه‌ها و رویدادهای پیش‌روی تقویم من را خلاصه کن.',
      toolExecutedPrefix: 'ابزارهای اجراشده:',
      runningComputerTools: 'در حال انجام عملیات روی پوشه‌های کامپیوتر...',
      computerFoldersLabel: 'پوشه‌های کامپیوتر:',
      connectFolderQuick: 'اتصال پوشه',
      noFoldersQuick: 'پوشه‌ای متصل نیست',
      deleteConfirmTitle: 'تایید حذف فایل یا پوشه در کامپیوتر',
      deleteConfirmBody: 'نورون مایند درخواست مجوز برای حذف دائمی موارد زیر از پوشه متصل کامپیوتر شما را دارد:',
      deleteConfirmProceed: 'حذف از کامپیوتر',
      deleteConfirmCancel: 'انصراف',
      captureScreen: 'گرفتن تصویر صفحه',
      attachFileOrImage: 'پیوست تصویر / فایل',
      attachmentsLabel: 'پیوست‌های گفتگو:',
      removeAttachment: 'حذف پیوست',
      speakReply: 'خواندن صوتی پاسخ',
      stopSpeaking: 'توقف صدا',
      newChat: 'گفتگوی جدید',
      plugins: 'افزونه‌ها (Plugins)',
      explore: 'کاوش قابلیت‌ها',
      searchChatsPlaceholder: 'جستجو در تاریخچه گفتگوها...',
      historyToday: 'امروز',
      historyWeek: '۷ روز گذشته',
      historyOlder: 'قدیمی‌تر',
      noMatchingChats: 'گفتگویی در تاریخچه یافت نشد.',
      toggleHistory: 'تاریخچه گفتگوها',
      deleteChat: 'حذف گفتگو',
      backToChat: 'بازگشت به گفتگو',
      exploreTitle: 'کاوش قابلیت‌های نورون مایند',
      exploreSubtitle: 'تمامی مهارت‌های دستیار در مدیریت فایل کامپیوتر، ایمیل، تقویم، تحقیق وب، کدنویسی، مالی و صوت را ببینید و با یک کلیک اجرا کنید.',
      pluginsTitle: 'افزونه‌ها و ابزارهای متصل',
      pluginsSubtitle: 'ماژول‌های واقعی متصل به هسته هوش مصنوعی. در صورت نیاز از همینجا بخش مربوطه را باز یا متصل کنید.',
      pluginActive: 'متصل',
      pluginNeedsConnect: 'نیازمند اتصال',
      openModule: 'باز کردن',
      tryPrompt: 'اجرا در چت',
    },
    tasks: {
      kicker: 'مدیریت وظایف مستقل از زبان',
      title: 'وظایف',
      subtitle:
        'وظایف خود را به فارسی یا انگلیسی ثبت و مدیریت کنید. هر وظیفه به‌صورت ساختاریافته ذخیره می‌شود و در هر دو زبان به‌صورت آنلاین و آفلاین در دسترس است.',
      addPlaceholder: 'افزودن وظیفه به فارسی یا انگلیسی...',
      dueDateLabel: 'مهلت انجام',
      priorityLabel: 'اولویت',
      priorityLow: 'کم',
      priorityMedium: 'متوسط',
      priorityHigh: 'زیاد',
      addButton: 'افزودن وظیفه',
      searchPlaceholder: 'جستجو در وظایف به هر زبان...',
      filterAll: 'همه',
      filterOpen: 'باز',
      filterCompleted: 'انجام‌شده',
      emptyTitle: 'وظیفه‌ای یافت نشد',
      emptySubtitle: 'یک وظیفه جدید اضافه کنید یا از نورون مایند بخواهید برایتان بسازد.',
      markDone: 'تکمیل',
      reopen: 'بازگشایی',
      editTask: 'ویرایش',
      saveEdit: 'ذخیره',
      cancelEdit: 'انصراف',
      deleteTask: 'حذف',
      sourceLabel: 'ثبت‌شده به',
      originalTextLabel: 'متن اصلی',
      statusTodo: 'باز',
      statusInProgress: 'در حال انجام',
      statusCompleted: 'تکمیل‌شده',
      askAssistant: 'برنامه‌ریزی وظایف با نورون مایند',
      askAssistantPrompt: 'وظایف باز من را بررسی کن و برای فردا اولویت‌بندی کن.',
    },
    calendar: {
      kicker: 'برنامه زمانی همگام‌سازی‌شده',
      title: 'تقویم',
      subtitle:
        'رویدادهای همگام‌سازی‌شده را به‌صورت آفلاین مشاهده کنید و رویدادهای جدید را مستقیماً یا از طریق نورون مایند ثبت نمایید.',
      eventTitlePlaceholder: 'عنوان رویداد (فارسی یا انگلیسی)...',
      startTimeLabel: 'تاریخ و ساعت',
      locationPlaceholder: 'مکان یا لینک جلسه (اختیاری)',
      addButton: 'افزودن رویداد',
      emptyTitle: 'رویدادی ثبت نشده است',
      emptySubtitle: 'رویداد جدیدی ثبت کنید یا از نورون مایند بخواهید زمان‌بندی کند.',
      deleteEvent: 'حذف',
      askAssistant: 'مدیریت برنامه با نورون مایند',
      askAssistantPrompt: 'رویدادهای پیش‌روی تقویم من را بررسی کن و زمان تمرکز پیشنهاد بده.',
      connectGoogleCalendar: 'اتصال به تقویم گوگل',
      pullGoogleEvents: 'همگام‌سازی از تقویم گوگل',
      syncingGoogle: 'در حال همگام‌سازی...',
      pushToGoogleLabel: 'ثبت همزمان در تقویم گوگل',
      googleConnectedNotice: 'اتصال تقویم گوگل در این نشست فعال است',
      googlePullSuccess: 'رویدادهای تقویم گوگل همگام‌سازی شدند.',
      googleDeleteConfirmTitle: 'حذف رویداد از تقویم گوگل',
      googleDeleteConfirmBody: 'آیا مطمئن هستید که این رویداد از فضای کاری و تقویم گوگل حذف شود؟',
      googleDeleteCancel: 'انصراف',
      googleDeleteProceed: 'حذف رویداد',
      quickTestOneMin: '+۱ دقیقه بعد',
      scheduledActionLabel: 'عملیات خودکار اختیاری در زمان رویداد',
      actionNone: 'فقط اعلان یادآوری (بدون عملیات خودکار)',
      actionCreateFolder: 'ساخت پوشه در مسیر متصل کامپیوتر',
      actionDownloadUrl: 'دانلود لینک پیوست‌شده در پوشه Downloads',
      actionCreateTask: 'ایجاد خودکار وظیفه اولویت‌دار',
      actionCreateDocument: 'ایجاد یادداشت یا سند در فایل‌ها',
      actionFolderPlaceholder: 'مسیر پوشه (مثلاً Meetings/Project-Review)',
      actionUrlPlaceholder: 'لینک مستقیم فایل، عکس یا ویدیو (https://...)',
      actionTaskPlaceholder: 'عنوان وظیفه هنگام فرا رسیدن زمان رویداد...',
      actionDocPlaceholder: 'عنوان سند هنگام فرا رسیدن زمان رویداد...',
      eventAlertBannerPrefix: 'زمان رویداد تقویم فرارسید:',
      actionStatusPending: 'زمان‌بندی‌شده',
      actionStatusExecuted: 'اجرا شد',
      actionStatusFailed: 'ناموفق',
    },
    files: {
      kicker: 'اسناد فضای کاری و حافظه آفلاین',
      title: 'فایل‌ها',
      subtitle:
        'یادداشت‌ها و گزارش‌های تولیدشده را ذخیره و جستجو کنید و اسناد مهم را برای دسترسی آفلاین نگه دارید.',
      docTitlePlaceholder: 'عنوان سند...',
      folderPlaceholder: 'پوشه (مثلاً یادداشت‌ها، گزارش‌ها)',
      contentPlaceholder: 'متن سند...',
      saveButton: 'ذخیره سند',
      searchPlaceholder: 'جستجو در اسناد...',
      cachedOfflineLabel: 'قابل دسترسی آفلاین',
      toggleOfflineCache: 'ذخیره آفلاین',
      deleteDoc: 'حذف',
      emptyTitle: 'هنوز سندی ذخیره نشده است',
      emptySubtitle: 'یک سند ثبت کنید یا از نورون مایند بخواهید گزارشی تهیه و ذخیره کند.',
      askAssistant: 'تهیه سند با نورون مایند',
      askAssistantPrompt: 'یک گزارش خلاصه ساختاریافته از وظایف و برنامه تقویم من تهیه و ذخیره کن.',
      importFile: 'وارد کردن فایل',
      exportFile: 'خروجی فایل',
      importedFolderLabel: 'واردشده',
      fileActionError: 'انجام عملیات فایل روی این دستگاه ممکن نشد.',
      computerSectionTitle: 'پوشه‌های کامپیوتر و دسترسی به دیسک محلی',
      computerSectionDesc: 'پوشه‌های واقعی کامپیوتر خود (مانند Desktop، Documents یا Downloads) را متصل کنید تا نورون مایند بتواند فایل‌ها و پوشه‌ها را مستقیماً لیست کند، بخواند، بسازد، تغییر نام دهد، جابه‌جا و مرتب‌سازی کند.',
      connectComputerFolder: 'اتصال پوشه کامپیوتر',
      noComputerFolders: 'هنوز پوشه‌ای از کامپیوتر متصل نشده است. روی «اتصال پوشه کامپیوتر» کلیک کنید تا به نورون مایند مجوز مدیریت پوشه را بدهید.',
      iframeBlockedNote: 'انتخابگر پوشه در فریم پیش‌نمایش محدود است. برای اتصال پوشه‌های کامپیوتر، نورون مایند را در برنامه دسکتاپ نصب‌شده یا پنجره مستقل Edge/Chrome باز کنید.',
      unsupportedFolderPickerNote: 'این مرورگر از دسترسی مستقیم به پوشه پشتیبانی نمی‌کند. لطفاً از برنامه دسکتاپ ویندوز نورون مایند یا مرورگر Edge / Chrome استفاده کنید.',
      folderPermissionGranted: 'دسترسی خواندن و نوشتن فعال',
      folderPermissionPrompt: 'نیازمند تایید مجوز',
      reconnectFolder: 'تایید مجدد',
      disconnectFolder: 'قطع اتصال',
      refreshFolder: 'بروزرسانی',
      askAgentFolder: 'مدیریت با هوش مصنوعی',
      askAgentFolderPromptPrefix: 'فایل‌ها و پوشه‌های داخل این پوشه متصل کامپیوتر را بررسی و مرتب کن:',
      newSubfolderPlaceholder: 'نام پوشه جدید...',
      createSubfolderButton: 'ساخت پوشه',
      newPcFilePlaceholder: 'نام فایل جدید (مثلاً notes.txt)...',
      newPcFileContentPlaceholder: 'محتوای فایل...',
      createPcFileButton: 'ذخیره فایل روی دیسک',
      searchPcPlaceholder: 'جستجو در پوشه متصل...',
      upOneLevel: 'بازگشت',
      rootLevel: 'ریشه',
      itemsLabel: 'مورد',
      openFolderAction: 'باز کردن',
      viewFileAction: 'خواندن / ویرایش',
      renameAction: 'تغییر نام',
      renamePlaceholder: 'نام جدید...',
      saveRename: 'ذخیره',
      deletePcEntryAction: 'حذف',
      emptyFolderNotice: 'این پوشه خالی است.',
      filePreviewTitle: 'ویرایشگر فایل کامپیوتر',
      saveFileChanges: 'ذخیره روی دیسک',
      closePreview: 'بستن',
    },
    emails: {
      kicker: 'اتصال به صندوق ایمیل خارجی',
      title: 'ایمیل‌ها',
      subtitle:
        'خلاصه‌سازی پیام‌ها و آماده‌سازی پیش‌نویس پاسخ از طریق نورون مایند پس از اتصال حساب ایمیل.',
      noAccountTitle: 'حساب جیمیل و تقویم گوگل خود را متصل کنید',
      noAccountBody:
        'با مجوز حساب گوگل، ایمیل‌های واقعی جیمیل را بخوانید، پیش‌نویس یا پاسخ ارسال کنید و رویدادهای تقویم گوگل را مستقیماً در نورون مایند همگام‌سازی نمایید.',
      capabilitiesTitle: 'قابلیت‌های پس از اتصال',
      cap1Title: 'خلاصه‌سازی دوزبانه ایمیل‌ها',
      cap1Desc: 'خواندن و تبدیل رشته‌های ایمیل فارسی و انگلیسی به خلاصه و کارهای اجرایی.',
      cap2Title: 'پیش‌نویس و ارسال با تایید شما',
      cap2Desc: 'ذخیره پیش‌نویس در جیمیل یا ارسال ایمیل تنها پس از تایید صریح شما.',
      nextStepsTitle: 'راهنمای گام‌به‌گام اتصال جیمیل و تقویم',
      step1: 'روی دکمه «اتصال جیمیل و تقویم گوگل» کلیک کنید و در صورت نیاز پاپ‌آپ مرورگر را مجاز کنید.',
      step2: 'اگر هشدار «Google hasn’t verified this app» نمایش داده شد، روی Advanced و سپس Continue بزنید.',
      step3: 'در صفحه مجوزهای گوگل، تمام تیک‌ها (Select all) برای جیمیل و تقویم گوگل را علامت بزنید و Continue را انتخاب کنید.',
      step4: 'برای امنیت بیشتر، توکن فقط در حافظه موقت مرورگر می‌ماند و پس از رفرش صفحه یا حدود ۱ ساعت می‌توانید دوباره دکمه اتصال را بزنید.',
      askAssistant: 'بررسی ایمیل‌ها با نورون مایند',
      askAssistantPrompt: 'صندوق جیمیل من را بررسی کن، پیام‌های مهم خوانده‌نشده را خلاصه کن و در پاسخ‌گویی کمک کن.',
      connectButton: 'اتصال جیمیل و تقویم گوگل',
      reconnectButton: 'اتصال مجدد حساب گوگل',
      connectedAsLabel: 'نشست فعال جیمیل:',
      refreshInbox: 'بروزرسانی صندوق',
      searchPlaceholder: 'جستجو در جیمیل (مثلاً is:unread)...',
      searchButton: 'جستجو',
      composeButton: 'ایمیل جدید',
      summarizeInboxAi: 'خلاصه‌سازی صندوق با هوش مصنوعی',
      loadingInbox: 'در حال دریافت ایمیل‌ها از جیمیل...',
      emptyInbox: 'پیامی در جیمیل با این فیلتر یافت نشد.',
      selectMessagePrompt: 'یک ایمیل را برای خواندن، خلاصه‌سازی یا پاسخ انتخاب کنید.',
      fromLabel: 'فرستنده',
      toLabel: 'گیرنده',
      dateLabel: 'تاریخ',
      subjectLabel: 'موضوع',
      bodyLabel: 'متن پیام',
      replyButton: 'پاسخ',
      summarizeMessageAi: 'خلاصه با هوش مصنوعی',
      draftReplyAi: 'پیش‌نویس پاسخ با هوش مصنوعی',
      saveDraftButton: 'ذخیره در پیش‌نویس جیمیل',
      sendEmailButton: 'ارسال ایمیل',
      closeCompose: 'انصراف',
      draftSavedNotice: 'پیش‌نویس در پوشه Drafts جیمیل شما ذخیره شد.',
      emailSentNotice: 'ایمیل با موفقیت از طریق جیمیل ارسال شد.',
      sendConfirmTitle: 'تایید ارسال ایمیل',
      sendConfirmBody: 'لطفاً پیش از ارسال از حساب جیمیل خود، گیرنده و موضوع پیام را به دقت بررسی کنید:',
      sendConfirmCancel: 'انصراف',
      sendConfirmProceed: 'تایید و ارسال',
      offlineNotice: 'دسترسی به جیمیل نیازمند اینترنت است. وظایف و اسناد محلی به‌صورت آفلاین در دسترس هستند.',
      unreadLabel: 'خوانده‌نشده',
      dailySummaryTitle: 'خلاصه روزانه ایمیل‌های مهم (تا ساعت ۲۰:۰۰)',
      dailySummarySubtitle: 'هر روز تا ساعت ۸ شب (۲۰:۰۰) ایمیل‌های مهم حساب متصل را بررسی، خلاصه‌سازی و نتیجه‌گیری می‌کند.',
      dailySummaryScheduleBadge: 'خودکار روزانه · ۲۰:۰۰',
      summarizeImportantNow: 'خلاصه‌سازی ایمیل‌های مهم اکنون',
      summarizingImportant: 'در حال تحلیل ایمیل‌های مهم...',
      dailyConclusionLabel: 'نتیجه‌گیری و جمع‌بندی روزانه',
      noImportantEmails: 'در پیام‌های بررسی‌شده، ایمیل فوری یا با اولویت بالا یافت نشد.',
      importantCountLabel: 'ایمیل مهم',
      scannedCountLabel: 'ایمیل بررسی‌شده',
      rememberedConnectionTitle: 'اتصال جیمیل در سیستم ذخیره شده است',
      rememberedConnectionBody: 'حساب ایمیل شما متصل باقی می‌ماند. هر زمان نیاز به دریافت پیام‌های جدید یا ارسال ایمیل داشتید، دکمه بروزرسانی نشست زنده را بزنید.',
      refreshLiveSession: 'بروزرسانی نشست زنده',
      apiDisabledTitle: 'فعال‌سازی Gmail و Calendar API در گوگل کلود (فقط یک‌بار)',
      apiDisabledBody: 'احراز هویت گوگل انجام شد، اما Gmail API یا Google Calendar API در پروژه 1022597897742 هنوز فعال نشده است. روی دکمه‌های زیر بزنید و Enable را انتخاب کنید، ۱ تا ۲ دقیقه صبر کنید و سپس تلاش مجدد را بزنید.',
      enableGmailApi: 'فعال‌سازی Gmail API',
      enableCalendarApi: 'فعال‌سازی Calendar API',
      retryConnection: 'تلاش مجدد',
      validationToRequired: 'لطفاً آدرس ایمیل گیرنده را در فیلد گیرنده (To) وارد کنید.',
      sendingStatus: 'در حال ارسال...',
      disconnectMailbox: 'قطع اتصال',
    },
    memory: {
      kicker: 'حافظه ماندگار دوزبانه',
      title: 'حافظه',
      subtitle:
        'ترجیحات شخصی، اطلاعات زمینه و عادت‌های کاری که نورون مایند در گفتگوهای فارسی و انگلیسی به خاطر می‌سپارد.',
      factPlaceholder: 'به خاطر بسپار که خلاصه صبحگاهی کوتاه را ترجیح می‌دهم...',
      categoryPreference: 'ترجیح شخصی',
      categoryContext: 'اطلاعات زمینه',
      categoryWorkflow: 'روند کاری',
      saveButton: 'ذخیره در حافظه',
      searchPlaceholder: 'جستجو در حافظه...',
      deleteMemory: 'حذف',
      emptyTitle: 'موردی در حافظه ثبت نشده است',
      emptySubtitle: 'یک ترجیح اضافه کنید یا به نورون مایند بگویید چه چیزی را به خاطر بسپارد.',
      askAssistant: 'مرور حافظه با نورون مایند',
      askAssistantPrompt: 'مواردی که تا الان درباره ترجیحات و روند کاری من ذخیره کرده‌ای خلاصه کن.',
    },
    automations: {
      kicker: 'قوانین و یادآورهای زمان‌بندی‌شده',
      title: 'خودکارسازی',
      subtitle:
        'ساخت یادآورها و روال‌های منظم برای هماهنگی امن ماژول‌های نورون مایند.',
      namePlaceholder: 'نام خودکارسازی...',
      triggerPlaceholder: 'شرط اجرا (مثلاً هر روز صبح ساعت ۸:۳۰)',
      actionPlaceholder: 'شرح اقدام...',
      createButton: 'ساخت قانون',
      enabled: 'فعال',
      paused: 'متوقف',
      deleteRule: 'حذف',
      emptyTitle: 'هنوز خودکارسازی تعریف نشده است',
      emptySubtitle: 'یک قانون بسازید یا از نورون مایند بخواهید یادآور تنظیم کند.',
      askAssistant: 'طراحی خودکارسازی با نورون مایند',
      askAssistantPrompt: 'یک خودکارسازی گزارش صبحگاهی برای ترکیب وظایف و تقویم طراحی کن.',
    },
    settings: {
      kicker: 'معماری سیستم · دوزبانه، آفلاین و همگام‌سازی ابری',
      title: 'تنظیمات',
      subtitle:
        'تنظیم زبان رابط کاربری، تشخیص خودکار زبان پیام، همگام‌سازی ابری Firebase، نصب PWA و وضعیت هوش مصنوعی سرور.',
      languageSectionTitle: 'زبان و جهت نمایش',
      languageLabel: 'زبان رابط کاربری',
      languageEnglish: 'English (چپ‌به‌راست)',
      languagePersian: 'فارسی (راست‌به‌چپ / RTL)',
      themeLabel: 'حالت نمایش',
      dayMode: 'روز',
      nightMode: 'شب',
      autoDetectLabel: 'تشخیص خودکار زبان پیام',
      autoDetectDesc: 'تغییر خودکار جهت نمایش هنگام ارسال پیام به فارسی یا انگلیسی.',
      accountSectionTitle: 'حساب کاربری و همگام‌سازی ابری (Firebase)',
      accountStatusLabel: 'وضعیت احراز هویت',
      offlineSyncSectionTitle: 'حافظه آفلاین و همگام‌سازی',
      connectivityLabel: 'وضعیت اتصال',
      pendingCountLabel: 'تغییرات در صف همگام‌سازی',
      syncButton: 'همگام‌سازی تغییرات در انتظار',
      pwaSectionTitle: 'نسخه موبایل و نصب برنامه (PWA)',
      pwaStatusLabel: 'وضعیت نصب',
      pwaInstalledLabel: 'در حال اجرا به‌عنوان برنامه نصب‌شده',
      pwaInstallAvailable: 'آماده نصب روی این دستگاه',
      geminiSectionTitle: 'موتور هوش مصنوعی Gemini',
      configured: 'پیکربندی شده',
      notConfigured: 'کلید تنظیم نشده',
      checking: 'در حال بررسی...',
      executionMode: 'حالت اجرا',
      serverSideSdk: 'SDK سمت سرور',
      defaultModel: 'مدل پیش‌فرض',
      credentialSource: 'منبع کلید',
      secretsPanel: 'Settings > Secrets',
      firebaseSectionTitle: 'ذخیره‌سازی Firestore',
      activeSessionStore: 'حالت ذخیره‌سازی',
      firestoreWithCache: 'Firestore + حافظه کش آفلاین محلی',
      plannedCollections: 'کالکشن‌ها',
      registryTitle: 'فهرست ابزارهای ثبت‌شده',
      totalLabel: 'مورد',
      colModule: 'ماژول',
      colId: 'شناسه',
      colTools: 'ابزارها',
      colStatus: 'وضعیت',
      conflictsResolvedLabel: 'تعارض‌های همگام‌سازی حل‌شده',
      platformSectionTitle: 'پلتفرم اجرایی و دسترسی‌های دستگاه',
      runtimePlatformLabel: 'پلتفرم فعال',
      platformWeb: 'مرورگر وب',
      platformPwa: 'وب‌اپلیکیشن نصب‌شده (PWA)',
      platformIos: 'اپلیکیشن iOS (Capacitor)',
      platformAndroid: 'اپلیکیشن اندروید (Capacitor)',
      platformWindows: 'نسخه دسکتاپ ویندوز (Tauri)',
      notificationPermLabel: 'اعلان‌ها (Notifications)',
      microphonePermLabel: 'میکروفون',
      permGranted: 'مجاز',
      permDenied: 'مسدود',
      permPrompt: 'درخواست هنگام استفاده',
      permUnsupported: 'در دسترس نیست',
      enableNotificationsButton: 'فعال‌سازی اعلان‌ها',
      testNotificationButton: 'ارسال اعلان آزمایشی',
      testNotificationTitle: 'اعلان نورون مایند آماده است',
      testNotificationBody: 'هشدارهای چندسکویی روی این دستگاه فعال هستند.',
      notificationSentNotice: 'اعلان ارسال شد.',
      notificationBlockedNotice: 'مجوز اعلان در این محیط مسدود یا غیرفعال است.',
      downloadsSectionTitle: 'فایل‌های قابل دانلود و راهنمای نصب (ویندوز · اندروید · iOS)',
      downloadsSectionDesc: 'برنامه را همین الان به‌صورت آفلاین روی هر سه پلتفرم نصب کنید یا پکیج‌های آماده ساخت فایل نصبی بومی (.msi/.exe، .apk/.aab، .ipa) و راهنمای کامل را دانلود نمایید.',
      downloadWindowsKit: 'پکیج ویندوز (.zip)',
      downloadAndroidKit: 'پکیج اندروید (.zip)',
      downloadIosKit: 'پکیج iOS (.zip)',
      downloadFullGuide: 'راهنمای کامل نصب (.md)',
      windowsGuideTitle: 'ویندوز ۱۰ و ۱۱',
      windowsGuideStep1: 'نصب یک‌کلیک دسکتاپ: فایل زیپ ویندوز را اکسترکت کنید و روی Install-Neuron-Mind.cmd دابل‌کلیک کنید (برنامه آفلاین، آیکون دسکتاپ/منوی استارت و بخش حذف برنامه ویندوز را نصب می‌کند).',
      windowsGuideStep2: 'اجرای فوری بدون نصب: روی Launch-Offline-Now.cmd کلیک کنید. سورس اختیاری Tauri برای ساخت .msi/.exe نیز داخل native-tauri-source قرار دارد.',
      androidGuideTitle: 'موبایل و تبلت اندروید',
      androidGuideStep1: 'نصب فوری آفلاین: در مرورگر Chrome دکمه Install App / Add to Home Screen را بزنید.',
      androidGuideStep2: 'فایل .apk/.aab: اسکریپت build-android.sh را با Android Studio و JDK 17 اجرا کنید یا از GitHub Actions خروجی بگیرید.',
      iosGuideTitle: 'آیفون و آیپد (iOS)',
      iosGuideStep1: 'نصب فوری آفلاین: در مرورگر Safari دکمه Share و سپس Add to Home Screen را انتخاب کنید.',
      iosGuideStep2: 'فایل .ipa / اپ‌استور: اسکریپت build-ios.sh را روی مک با Xcode 15+ اجرا کنید یا از GitHub Actions استفاده کنید.',
      nativeCompileNote: 'ساخت فایل‌های اجرایی نهایی (.exe/.msi، .apk/.aab و .ipa) نیازمند کامپایلرهای ویندوز/اندروید/مک یا اجرای ورک‌فلو GitHub Actions همراه پروژه است.',
      downloadFailedError: 'دانلود پکیج با خطا مواجه شد. لطفاً از اتصال اینترنت خود مطمئن شوید و دوباره تلاش کنید.',
      securitySectionTitle: 'مدیریت امنیت و سخت‌افزار سیستم',
      securitySectionDesc: 'بررسی مجوزهای دستگاه، دسترسی پوشه‌های متصل کامپیوتر، وضعیت قفل گاوصندوق رمزنگاری‌شده و آمار واقعی سخت‌افزار.',
      connectedFoldersCount: 'پوشه‌های متصل کامپیوتر',
      clipboardPermLabel: 'دسترسی کلیپ‌بورد',
      vaultStatusLabel: 'گاوصندوق رمزنگاری (AES-256-GCM)',
      vaultUnlockedStatus: 'باز در حافظه موقت نشست',
      vaultLockedStatus: 'قفل‌شده (رمزنگاری روی دیسک)',
      deleteConfirmPolicyLabel: 'درخواست تایید صریح پیش از حذف فایل',
      deleteConfirmPolicyDesc: 'همواره پیش از حذف فایل یا پوشه از کامپیوتر، پنجره تایید نمایش داده می‌شود.',
      systemTelemetryTitle: 'وضعیت زنده سخت‌افزار و سرور',
      cpuCoresLabel: 'هسته‌های پردازنده (دستگاه / سرور)',
      memoryLabel: 'حافظه رم',
      storageQuotaLabel: 'فضای ذخیره‌سازی مرورگر',
      refreshTelemetry: 'بروزرسانی آمار',
    },
    research: {
      kicker: 'جستجوی زنده وب · بررسی صفحات · مدیریت دانلود · لانچر',
      title: 'تحقیق و وب',
      subtitle: 'جستجوی زنده اینترنت همراه با منابع معتبر، تحلیل صفحات وب، دانلود امن فایل‌ها در کامپیوتر و باز کردن برنامه‌ها یا لینک‌های مجاز.',
      tabSearch: 'جستجوی اینترنت',
      tabBrowser: 'تحلیل صفحه وب',
      tabDownloads: 'مدیریت دانلود',
      tabApps: 'کنترل برنامه‌ها',
      queryPlaceholder: 'عبارت جستجو به فارسی یا انگلیسی...',
      searchButton: 'جستجو در وب',
      searching: 'در حال جستجوی منابع زنده...',
      sourcesTitle: 'منابع تاییدشده',
      noSources: 'لینک منبعی بازگردانده نشد.',
      urlPlaceholder: 'https://example.com/article',
      inspectPromptPlaceholder: 'چه اطلاعاتی از این صفحه استخراج یا خلاصه شود؟',
      inspectButton: 'خواندن و تحلیل لینک',
      inspecting: 'در حال بررسی صفحه...',
      downloadUrlPlaceholder: 'لینک یوتیوب (youtube.com/watch?v=...) یا فایل',
      downloadButton: 'دانلود امن',
      downloading: 'در حال دانلود...',
      downloadHistoryEmpty: 'هنوز دانلودی ثبت نشده است.',
      browserBoundaryNote: 'محدودیت امنیتی مرورگر اجازه کنترل مستقیم تب‌های خارجی را نمی‌دهد؛ ابزار تحلیل صفحه، لینک‌های عمومی مجاز را از سرور می‌خواند.',
      appNamePlaceholder: 'نام برنامه یا سایت',
      appUriPlaceholder: 'آدرس یا پروتکل (مثلاً vscode://file یا https://...)',
      addAppButton: 'افزودن لینک مجاز',
      launchButton: 'اجرا',
      appBoundaryNote: 'مرورگر فقط اجرای پروتکل‌های مجاز با کلیک کاربر را می‌پذیرد؛ بستن اجباری برنامه‌های ویندوز نیازمند اجرای نسخه بومی Tauri است.',
      downloadGuideNote: 'لینک مستقیم فایل (.mp4، .mp3، .png، .jpg، .pdf، .zip) یا لینک صفحه حاوی رسانه را وارد کنید. با اتصال پوشه کامپیوتر، فایل‌ها مستقیماً در پوشه Downloads ذخیره می‌شوند.',
      connectDownloadsTip: 'اتصال پوشه Downloads کامپیوتر',
      saveCopyButton: 'ذخیره مجدد',
      appsGuideTitle: 'راهنمای بخش کنترل برنامه‌ها و لینک مجاز (Authorize Link)',
      appsGuideBody: '۱) روی دکمه اجرا کنار هر برنامه دسکتاپ یا وب‌سایت کلیک کنید تا فوراً باز شود. ۲) برای افزودن لینک یا برنامه جدید در بخش Authorize Link، نام و آدرس URI آن را وارد کنید: برای سایت‌ها از https://...، برای ویندوز و برنامه‌ها از پروتکل‌هایی مثل vscode://file، ms-settings:، calculator:، spotify:، tg:// یا mailto: استفاده کنید.',
      appsFilterAll: 'همه',
      appsFilterDesktop: 'برنامه‌های دسکتاپ',
      appsFilterWeb: 'وب‌سایت‌ها',
      restoreDefaultsButton: 'بارگذاری همه پیشنهادها',
      videoQualityLabel: 'کیفیت ویدیو',
      qualityBest: 'بهترین کیفیت ویدیوی کامل (MP4)',
      quality720p: 'ویدیوی HD ۷۲۰p (MP4)',
      quality480p: 'ویدیوی ۴۸۰p (MP4)',
      qualityAudio: 'فقط صدا (MP3)',
      youtubeOptionsToggle: 'تنظیمات نشست یوتیوب (در صورت درخواست تایید ربات)',
      youtubeOptionsDesc: 'لینک‌های یوتیوب به‌جای تصویر کاور، کل فایل کامل ویدیو (تا ۵۰۰ مگابایت) را دانلود می‌کنند. اگر یوتیوب به آی‌پی سرور ابری خطای ربات داد، فایل cookies.txt مرورگر خود را بارگذاری یا جای‌گذاری کنید (فقط در حافظه موقت نگه داشته می‌شود).',
      cookiesUploadButton: 'انتخاب فایل cookies.txt',
      cookiesPlaceholder: 'اختیاری: متن فایل Netscape cookies.txt را اینجا وارد کنید...',
      cobaltPlaceholder: 'اختیاری: آدرس سرور Cobalt (مثلاً https://your-cobalt-server)',
      clearCookiesButton: 'پاک کردن کوکی‌ها',
    },
    workbench: {
      kicker: 'دستیار کد · بررسی گیت · ساخت پروژه · پایگاه‌داده شخصی',
      title: 'میز کار توسعه و داده',
      subtitle: 'ساخت قالب پروژه نرم‌افزاری، بررسی مخزن Git در پوشه‌های متصل، ارسال کد به هوش مصنوعی و مدیریت جداول ساختاریافته CSV/JSON.',
      tabCode: 'کد و دستیار هوشمند',
      tabGit: 'بررسی گیت',
      tabScaffold: 'ساخت پروژه',
      tabTables: 'جداول داده',
      gitPathPlaceholder: 'مسیر زیرپوشه (اختیاری، مثلاً my-repo)',
      inspectGitButton: 'بررسی اطلاعات .git',
      gitBranchLabel: 'شاخه فعلی (Branch)',
      gitRemotesLabel: 'مخازن راه‌دور (Remotes)',
      gitCommitsLabel: 'کامیت‌های اخیر',
      projectNamePlaceholder: 'نام پروژه (مثلاً invoice-api)',
      templateLabel: 'قالب آماده',
      scaffoldButton: 'ایجاد فایل‌های پروژه',
      sendCodeToAi: 'ارسال به دستیار برای توضیح / رفع خطا',
      tableNamePlaceholder: 'نام جدول (مثلاً مشتریان)',
      tableColumnsPlaceholder: 'ستون‌ها با ویرگول (مثلاً Name, Email, Status)',
      createTableButton: 'ساخت جدول',
      addRowButton: 'افزودن ردیف',
      exportCsvButton: 'خروجی CSV',
      noTablesTitle: 'هنوز جدولی ساخته نشده است',
      noTablesDesc: 'یک جدول ساختاریافته بسازید یا از نورون مایند بخواهید برایتان ایجاد و جستجو کند.',
    },
    hub: {
      kicker: 'صوت جلسات · امور مالی · گاوصندوق رمزنگاری · تاریخچه فعالیت',
      title: 'گاوصندوق، مالی و جلسات',
      subtitle: 'پیاده‌سازی متن صوت جلسات و استخراج کارها، مدیریت درآمد و هزینه، نگهداری امن رمزها با AES-GCM و مشاهده گزارش کامل فعالیت‌ها.',
      tabMeetings: 'دستیار جلسات',
      tabFinance: 'مدیریت مالی',
      tabVault: 'گاوصندوق رمز',
      tabActivity: 'تاریخچه فعالیت',
      recordMeetingStart: 'ضبط صدا با میکروفون',
      recordMeetingStop: 'توقف و تبدیل به متن',
      uploadAudioButton: 'آپلود فایل صوتی',
      transcribingLabel: 'در حال پیاده‌سازی متن و استخراج تصمیم‌ها...',
      transcriptTitle: 'متن پیاده‌سازی‌شده',
      decisionsTitle: 'تصمیم‌های جلسه',
      actionItemsTitle: 'اقدامات استخراج‌شده',
      convertActionsToTasks: 'تبدیل اقدامات به وظایف',
      saveMeetingDoc: 'ذخیره صورت‌جلسه در فایل‌ها',
      financeIncome: 'درآمد',
      financeExpense: 'هزینه',
      financeAmountPlaceholder: 'مبلغ',
      financeCategoryPlaceholder: 'دسته‌بندی (مثلاً حقوق، خرید)',
      financeNotePlaceholder: 'توضیح...',
      addEntryButton: 'ثبت تراکنش',
      totalIncomeLabel: 'مجموع درآمد',
      totalExpenseLabel: 'مجموع هزینه',
      netBalanceLabel: 'تراز خالص',
      exportFinanceCsv: 'خروجی CSV',
      vaultMasterPrompt: 'رمز اصلی گاوصندوق را وارد یا تعریف کنید تا اطلاعات با AES-256-GCM رمزگشایی شوند. رمزها هرگز به‌صورت متن ساده ذخیره یا به هوش مصنوعی ارسال نمی‌شوند.',
      vaultCreatePassPlaceholder: 'تعریف رمز اصلی (حداقل ۴ کاراکتر)',
      vaultUnlockPassPlaceholder: 'رمز اصلی گاوصندوق را وارد کنید',
      vaultUnlockButton: 'باز کردن گاوصندوق',
      vaultLockButton: 'قفل کردن',
      vaultLabelPlaceholder: 'نام سرویس (مثلاً GitHub)',
      vaultUserPlaceholder: 'نام کاربری / ایمیل',
      vaultSecretPlaceholder: 'رمز عبور یا توکن',
      vaultAddButton: 'رمزنگاری و ذخیره',
      vaultCopySecret: 'کپی رمز',
      vaultZeroPlaintextNote: 'رمزنگاری محلی با PBKDF2 + AES-256-GCM. رمز اصلی هیچ‌جا ذخیره نمی‌شود.',
      activitySearchPlaceholder: 'جستجو در گزارش فعالیت‌ها...',
      activityEmpty: 'هنوز فعالیتی ثبت نشده است.',
      statusSuccess: 'موفق',
      statusWarning: 'هشدار',
      statusError: 'خطا',
      financeGuideTitle: 'بخش مدیریت مالی چه کاری انجام می‌دهد؟',
      financeGuideBody: 'درآمدها و هزینه‌های خود را به ارزهای مختلف (دلار، تومان/ریال، یورو) ثبت کنید، سقف بودجه ماهانه برای هر دسته‌بندی تعیین نمایید، سهم هزینه‌های هر دسته و نرخ پس‌انداز را ببینید، خروجی اکسل/CSV بگیرید و از هوش مصنوعی تحلیل مالی بخواهید.',
      budgetLimitsTitle: 'سقف بودجه ماهانه دسته‌بندی‌ها',
      budgetCategoryPlaceholder: 'دسته‌بندی (مثلاً خرید روزانه)',
      budgetLimitPlaceholder: 'سقف بودجه',
      setBudgetButton: 'ثبت سقف بودجه',
      categoryBreakdownTitle: 'تفکیک هزینه بر اساس دسته‌بندی',
      savingsRateLabel: 'نرخ پس‌انداز',
      analyzeFinanceAi: 'تحلیل مالی با هوش مصنوعی',
      analyzeFinancePrompt: 'درآمدها، هزینه‌ها و دسته‌بندی‌های مالی من را تحلیل کن و پیشنهادهای کاربردی برای بهبود بودجه ارائه بده.',
      vaultGuideTitle: 'گاوصندوق رمز چه کاری انجام می‌دهد و چطور از شما محافظت می‌کند؟',
      vaultGuideBody: 'رمزهای عبور حساس، کلیدهای API، کدهای بازیابی و پین‌های شخصی را در یک گاوصندوق محلی کاملاً رمزنگاری‌شده نگهداری کنید. تمام داده‌ها با استاندارد PBKDF2 و AES-256-GCM در مرورگر رمزنگاری می‌شوند و هرگز به سرور یا هوش مصنوعی ارسال نمی‌گردند.',
    },
    extras: {
      tabFilesExplorer: 'فایل‌ها و پوشه‌ها',
      tabMediaOrganizer: 'مرتب‌سازی رسانه',
      tabBackups: 'پشتیبان‌گیری و بازیابی',
      tabClipboard: 'تاریخچه کلیپ‌بورد',
      scanMediaButton: 'اسکن فایل‌های رسانه‌ای پوشه متصل',
      organizeMediaButton: 'انتقال و دسته‌بندی در پوشه‌های Photos / Videos / Audio / Docs',
      mediaPhotos: 'تصاویر',
      mediaVideos: 'ویدیوها',
      mediaAudio: 'صوت‌ها',
      mediaDocs: 'اسناد',
      backupJsonButton: 'ساخت نسخه پشتیبان تاییدشده (JSON)',
      backupZipButton: 'دانلود آرشیو پشتیبان (ZIP)',
      restoreBackupButton: 'بررسی و بازیابی فایل پشتیبان (.json)',
      backupStatusSuccess: 'نسخه پشتیبان ساخته و تایید شد',
      captureClipboardButton: 'دریافت از کلیپ‌بورد سیستم',
      clipboardPlaceholder: 'متنی را در تاریخچه کلیپ‌بورد ذخیره کنید...',
      saveClipboardButton: 'ذخیره کلیپ',
      copyAction: 'کپی',
      tabTasksList: 'فهرست وظایف',
      tabReminders: 'یادآورها',
      tabScheduler: 'برنامه روزانه هوشمند',
      reminderTitlePlaceholder: 'عنوان یادآور (فارسی یا انگلیسی)...',
      reminderRecurrenceLabel: 'تکرار',
      recurrenceNone: 'یک‌بار',
      recurrenceDaily: 'روزانه',
      recurrenceWeekly: 'هفتگی',
      recurrenceMonthly: 'ماهانه',
      addReminderButton: 'ثبت یادآور',
      dueAlertBannerPrefix: 'زمان یادآور فرارسید:',
      generatePlanButton: 'تولید برنامه روزانه هوشمند',
      savePlanDocButton: 'ذخیره برنامه در فایل‌ها',
      runAutomationNow: 'اجرای فوری',
      automationRanNotice: 'خودکارسازی با موفقیت اجرا و ثبت شد.',
    },
    designers: {
      buttonLabel: 'طراحان سیستم',
      modalTitle: 'طراحان سیستم',
      modalSubtitle: 'طراحی و توسعه داده‌شده برای نورون مایند. برای ارتباط مستقیم با طراحان سیستم از واتساپ یا ایمیل استفاده کنید.',
      roleLabel: 'طراح سیستم',
      whatsappLabel: 'واتساپ',
      emailLabel: 'ایمیل',
      closeModal: 'بستن',
    },
    notifications: {
      calendarEventTitle: 'اعلان رویداد تقویم',
      reminderTitle: 'زمان یادآور فرارسید',
      emailSummaryTitle: 'خلاصه روزانه ایمیل‌های مهم (۲۰:۰۰)',
      notificationDelivered: 'اعلان نمایش داده شد',
      openSection: 'مشاهده',
      dismiss: 'بستن',
    },
  },
};
