package edu.iter.eduhub.feature.main

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import edu.iter.eduhub.core.data.PortalDataSource
import edu.iter.eduhub.core.model.*
import edu.iter.eduhub.core.ui.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

class PortalViewModel(
    private val repository: PortalDataSource
) : ViewModel() {
    private val _session = MutableStateFlow(repository.currentSession())
    val session: StateFlow<AppSession?> = _session.asStateFlow()

    private val _publicState = MutableStateFlow<UiState<PublicContent>>(UiState.Loading)
    val publicState: StateFlow<UiState<PublicContent>> = _publicState.asStateFlow()

    private val _portalStatusState = MutableStateFlow<UiState<PortalStatusPayload>>(UiState.Loading)
    val portalStatusState: StateFlow<UiState<PortalStatusPayload>> = _portalStatusState.asStateFlow()

    private val _portalDataState = MutableStateFlow<UiState<PortalDataPayload>>(UiState.Idle)
    val portalDataState: StateFlow<UiState<PortalDataPayload>> = _portalDataState.asStateFlow()

    private val _portalBusy = MutableStateFlow(false)
    val portalBusy: StateFlow<Boolean> = _portalBusy.asStateFlow()

    private val _actionBusy = MutableStateFlow(false)
    val actionBusy: StateFlow<Boolean> = _actionBusy.asStateFlow()

    private val _snapshotState = MutableStateFlow<UiState<MobileSnapshot>>(UiState.Idle)
    val snapshotState: StateFlow<UiState<MobileSnapshot>> = _snapshotState.asStateFlow()

    private val _notificationsState = MutableStateFlow<UiState<List<NotificationItem>>>(UiState.Idle)
    val notificationsState: StateFlow<UiState<List<NotificationItem>>> = _notificationsState.asStateFlow()

    private val _searchState = MutableStateFlow<UiState<List<SearchResultItem>>>(UiState.Idle)
    val searchState: StateFlow<UiState<List<SearchResultItem>>> = _searchState.asStateFlow()

    private val _messages = MutableStateFlow<List<AiChatMessage>>(emptyList())
    val messages: StateFlow<List<AiChatMessage>> = _messages.asStateFlow()

    private val _toastMessage = MutableStateFlow<String?>(null)
    val toastMessage: StateFlow<String?> = _toastMessage.asStateFlow()

    init {
        loadPublicContent()
        loadPortalStatus()
        if (_session.value != null) {
            loadSnapshot()
            loadNotifications()
        }
    }

    fun consumeToast() {
        _toastMessage.value = null
    }

    fun loadPublicContent() {
        viewModelScope.launch {
            _publicState.value = UiState.Loading
            repository.publicContent()
                .onSuccess { _publicState.value = UiState.Success(it) }
                .onFailure { _publicState.value = UiState.Error(it.message ?: "Unable to load content") }
        }
    }

    fun loadPortalStatus() {
        viewModelScope.launch {
            _portalStatusState.value = UiState.Loading
            repository.portalStatus()
                .onSuccess { _portalStatusState.value = UiState.Success(it) }
                .onFailure { _portalStatusState.value = UiState.Error(it.message ?: "Unable to load portal status") }
        }
    }

    fun loadPortalData() {
        if (_session.value == null) {
            _portalDataState.value = UiState.Error("Sign in to view your stored portal data.")
            return
        }

        viewModelScope.launch {
            _portalDataState.value = UiState.Loading
            repository.portalData()
                .onSuccess { _portalDataState.value = UiState.Success(it) }
                .onFailure { _portalDataState.value = UiState.Error(it.message ?: "Unable to load portal data") }
        }
    }

    fun loadSnapshot() {
        viewModelScope.launch {
            _snapshotState.value = UiState.Loading
            repository.snapshot()
                .onSuccess { _snapshotState.value = UiState.Success(it) }
                .onFailure { _snapshotState.value = UiState.Error(it.message ?: "Unable to load snapshot") }
        }
    }

    fun loadNotifications() {
        viewModelScope.launch {
            _notificationsState.value = UiState.Loading
            repository.notifications()
                .onSuccess { _notificationsState.value = UiState.Success(it) }
                .onFailure { _notificationsState.value = UiState.Error(it.message ?: "Unable to load notifications") }
        }
    }

    fun refresh() {
        loadSnapshot()
        loadNotifications()
    }

    fun onSignedIn(session: AppSession) {
        _session.value = session
        loadPortalStatus()
        refresh()
    }

    fun signOut() {
        repository.signOut()
        _session.value = null
        _portalStatusState.value = UiState.Idle
        _portalDataState.value = UiState.Idle
        _snapshotState.value = UiState.Idle
        _notificationsState.value = UiState.Idle
        _messages.value = emptyList()
    }

    fun search(query: String) {
        if (query.length < 2) {
            _searchState.value = UiState.Idle
            return
        }
        viewModelScope.launch {
            _searchState.value = UiState.Loading
            repository.search(query)
                .onSuccess { _searchState.value = UiState.Success(it) }
                .onFailure { _searchState.value = UiState.Error(it.message ?: "Search failed") }
        }
    }

    fun markNotificationRead(id: String) {
        viewModelScope.launch {
            repository.markNotificationRead(id)
            loadNotifications()
            loadSnapshot()
        }
    }

    fun registerEvent(eventId: String) = action("Registered for event") { repository.registerEvent(eventId) }
    fun joinClub(clubId: String) = action("Joined club") { repository.joinClub(clubId) }
    fun leaveClub(clubId: String) = action("Left club") { repository.leaveClub(clubId) }
    fun createPayment(request: CreatePaymentRequest) = action("Payment created") { repository.createPayment(request) }
    fun createAnnouncement(request: CreateAnnouncementRequest) = action("Announcement created") { repository.createAnnouncement(request) }
    fun updateSettings(settings: List<SettingItem>) = action("Settings saved") { repository.updateSettings(settings) }
    fun toggleUserActive(userId: String) = action("User status updated") { repository.toggleUserActive(userId) }
    fun approveFile(fileId: String) = action("File approved") { repository.approveFile(fileId) }
    fun markAttendance(request: MarkAttendanceRequest) = action("Attendance submitted") { repository.markAttendance(request) }
    fun uploadMarks(request: UploadMarksRequest) = action("Marks uploaded") { repository.uploadMarks(request) }
    fun createAssignment(request: CreateAssignmentRequest) = action("Assignment created") { repository.createAssignment(request) }
    fun createQuestion(request: CreateQuestionRequest) = action("Question saved") { repository.createQuestion(request) }
    fun updateQuestion(id: String, request: CreateQuestionRequest) = action("Question updated") { repository.updateQuestion(id, request) }
    fun deleteQuestion(id: String) = action("Question deleted") { repository.deleteQuestion(id) }
    fun createRubric(request: CreateRubricRequest) = action("Rubric saved") { repository.createRubric(request) }
    fun createForumQuestion(title: String, description: String, category: String) =
        action("Question posted") { repository.createForumQuestion(title, description, category) }

    fun answerForumQuestion(questionId: String, answer: String) =
        action("Answer posted") { repository.answerForumQuestion(questionId, answer) }

    fun uploadFile(fileUri: Uri, fileName: String, category: String, subject: String?, description: String?) =
        action("File uploaded") { repository.uploadFile(fileUri, fileName, category, subject, description) }

    fun uploadNote(
        fileUri: Uri,
        fileName: String,
        title: String,
        subject: String,
        branch: String,
        semester: String,
        description: String?
    ) = action("Note uploaded") {
        repository.uploadNote(fileUri, fileName, title, subject, branch, semester, description)
    }

    fun sendAiMessage(message: String) {
        if (message.isBlank()) return
        _messages.value = _messages.value + AiChatMessage(role = "user", content = message)
        viewModelScope.launch {
            repository.chatWithAi(message)
                .onSuccess { response ->
                    _messages.value = _messages.value + response
                }
                .onFailure { error ->
                    _messages.value = _messages.value + AiChatMessage(
                        role = "assistant",
                        content = error.message ?: "Unable to reach the AI assistant."
                    )
                }
        }
    }

    fun loadSettings(onLoaded: (List<SettingItem>) -> Unit) {
        viewModelScope.launch {
            repository.loadSettings()
                .onSuccess(onLoaded)
                .onFailure { _toastMessage.value = it.message ?: "Unable to load settings" }
        }
    }

    fun downloadReceipt(paymentId: String, fileName: String, onReady: (File) -> Unit) {
        viewModelScope.launch {
            repository.downloadReceipt(paymentId, fileName)
                .onSuccess(onReady)
                .onFailure { _toastMessage.value = it.message ?: "Receipt download failed" }
        }
    }

    fun downloadFile(fileId: String, fileName: String, onReady: (File) -> Unit) {
        viewModelScope.launch {
            repository.downloadFile(fileId, fileName)
                .onSuccess(onReady)
                .onFailure { _toastMessage.value = it.message ?: "File download failed" }
        }
    }

    fun downloadProtectedFile(url: String, fileName: String, onReady: (File) -> Unit) {
        viewModelScope.launch {
            repository.downloadProtectedFile(url, fileName)
                .onSuccess(onReady)
                .onFailure { _toastMessage.value = it.message ?: "File download failed" }
        }
    }

    fun openCachedFile(file: File, mimeType: String = "application/pdf") {
        repository.openCachedFile(file, mimeType)
    }

    fun enqueueExternalDownload(url: String, fileName: String) {
        repository.enqueueExternalDownload(url, fileName)
        _toastMessage.value = "Download started for $fileName"
    }

    fun connectPortal(registrationNumber: String, password: String) {
        if (registrationNumber.isBlank() || password.isBlank()) {
            _toastMessage.value = "Registration number and portal password are required"
            return
        }

        portalDataAction { repository.connectPortal(registrationNumber.trim(), password) }
    }

    fun recoverPortalData(registrationNumber: String?) {
        val value = registrationNumber?.trim()?.takeIf { it.isNotBlank() }
        if (_session.value == null && value == null) {
            _toastMessage.value = "Enter a registration number or sign in first"
            return
        }

        portalDataAction { repository.recoverPortalData(value) }
    }

    fun loadPortalDemo() {
        portalDataAction(refreshSnapshot = _session.value != null) { repository.loadPortalDemo() }
    }

    fun disconnectPortal() {
        if (_session.value == null) {
            _toastMessage.value = "Sign in to disconnect portal data"
            return
        }

        viewModelScope.launch {
            _portalBusy.value = true
            repository.disconnectPortal()
                .onSuccess {
                    _portalDataState.value = UiState.Idle
                    _toastMessage.value = "Portal disconnected"
                    loadPortalStatus()
                    refresh()
                }
                .onFailure {
                    _toastMessage.value = it.message ?: "Unable to disconnect portal"
                }
            _portalBusy.value = false
        }
    }

    private fun action(successMessage: String, block: suspend () -> Result<Unit>) {
        viewModelScope.launch {
            _actionBusy.value = true
            block()
                .onSuccess {
                    _toastMessage.value = successMessage
                    refresh()
                }
                .onFailure {
                    _toastMessage.value = it.message ?: "Action failed"
                }
            _actionBusy.value = false
        }
    }

    private fun portalDataAction(
        refreshSnapshot: Boolean = _session.value != null,
        block: suspend () -> Result<PortalDataPayload>
    ) {
        viewModelScope.launch {
            _portalBusy.value = true
            _portalDataState.value = UiState.Loading
            block()
                .onSuccess { data ->
                    _portalDataState.value = UiState.Success(data)
                    _toastMessage.value = portalSuccessMessage(data)
                    loadPortalStatus()
                    if (refreshSnapshot) {
                        refresh()
                    }
                }
                .onFailure {
                    val message = it.message ?: "Portal action failed"
                    _portalDataState.value = UiState.Error(message)
                    _toastMessage.value = message
                }
            _portalBusy.value = false
        }
    }

    private fun portalSuccessMessage(data: PortalDataPayload): String = when {
        data.portalConnected && data.isVerified -> "Portal synced successfully"
        data.dataSource?.contains("backup", ignoreCase = true) == true -> "Backup data loaded"
        data.dataSource?.contains("demo", ignoreCase = true) == true || data.mode == "demo" -> "Demo portal data loaded"
        else -> "Portal data updated"
    }
}
