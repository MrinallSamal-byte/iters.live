package edu.iter.eduhub.core.data

import android.content.Context
import android.net.Uri
import edu.iter.eduhub.BuildConfig
import edu.iter.eduhub.core.model.*
import edu.iter.eduhub.core.network.ApiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class PortalRepository(
    private val context: Context,
    private val apiService: ApiService,
    private val sessionStore: SessionStore,
    private val fileTransferManager: FileTransferManager
) : PortalDataSource {
    private val baseUrl = BuildConfig.DEFAULT_API_BASE_URL.trim().removeSuffix("/")

    override fun currentSession(): AppSession? = sessionStore.readSession()

    override suspend fun login(request: LoginRequest): Result<AppSession> = runCatching {
        val payload = apiService.login(request).data ?: error("Login failed")
        val token = payload.appAccessToken ?: payload.accessToken ?: error("Missing access token")
        AppSession(
            user = payload.user,
            token = token,
            demoMode = payload.demoMode,
            authMode = payload.authMode
        ).also(sessionStore::writeSession)
    }

    override suspend fun register(request: RegistrationRequest): Result<LoginPayload> = runCatching {
        apiService.register(request).data ?: error("Registration failed")
    }

    override suspend fun publicContent(): Result<PublicContent> = runCatching {
        apiService.getPublicContent().data ?: PublicContent()
    }

    override suspend fun portalStatus(): Result<PortalStatusPayload> = runCatching {
        apiService.getPortalStatus(optionalAuthorizationHeader()).data ?: PortalStatusPayload()
    }

    override suspend fun portalData(): Result<PortalDataPayload> = authorized { header ->
        apiService.getPortalData(header).data ?: error("Portal data unavailable")
    }

    override suspend fun connectPortal(registrationNumber: String, password: String): Result<PortalDataPayload> = runCatching {
        val response = apiService.connectPortal(
            authorization = optionalAuthorizationHeader(),
            request = PortalCredentialsRequest(registrationNumber, password)
        )
        response.data ?: error(response.message ?: "Unable to connect to the portal")
    }

    override suspend fun recoverPortalData(registrationNumber: String?): Result<PortalDataPayload> = runCatching {
        val header = optionalAuthorizationHeader()
        val recoverResponse = try {
            apiService.recoverPortalData(header, registrationNumber)
        } catch (_: Throwable) {
            null
        }

        when {
            recoverResponse?.success == true && recoverResponse.data != null -> recoverResponse.data!!
            else -> {
                val backupResponse = apiService.loadPortalBackup(header, PortalLookupRequest(registrationNumber))
                backupResponse.data ?: error(
                    backupResponse.message
                        ?: recoverResponse?.message
                        ?: "No backup data found"
                )
            }
        }
    }

    override suspend fun loadPortalDemo(): Result<PortalDataPayload> = runCatching {
        apiService.loadPortalDemo().data ?: error("Demo portal data unavailable")
    }

    override suspend fun disconnectPortal(): Result<Unit> = authorized { header ->
        apiService.disconnectPortal(header)
        Unit
    }

    override suspend fun snapshot(): Result<MobileSnapshot> = runCatching {
        val session = requireSession()
        apiService.getSnapshot(session.authorizationHeader()).data ?: error("Snapshot unavailable")
    }

    override suspend fun notifications(): Result<List<NotificationItem>> =
        snapshot().map { it.notifications.items }

    override suspend fun markNotificationRead(id: String): Result<Unit> = runCatching {
        val session = requireSession()
        apiService.markNotificationRead(session.authorizationHeader(), id)
    }.map { Unit }

    override suspend fun search(query: String): Result<List<SearchResultItem>> = runCatching {
        val session = requireSession()
        apiService.search(session.authorizationHeader(), query).results
    }

    override suspend fun registerEvent(eventId: String): Result<Unit> = authorized { header ->
        apiService.registerEvent(header, eventId)
        Unit
    }

    override suspend fun joinClub(clubId: String): Result<Unit> = authorized { header ->
        apiService.joinClub(header, clubId)
        Unit
    }

    override suspend fun leaveClub(clubId: String): Result<Unit> = authorized { header ->
        apiService.leaveClub(header, clubId)
        Unit
    }

    override suspend fun createPayment(request: CreatePaymentRequest): Result<Unit> = authorized { header ->
        apiService.createPayment(header, request)
        Unit
    }

    override suspend fun createAnnouncement(request: CreateAnnouncementRequest): Result<Unit> = authorized { header ->
        apiService.createAnnouncement(header, request)
        Unit
    }

    override suspend fun loadSettings(): Result<List<SettingItem>> = authorized { header ->
        apiService.getSettings(header).data ?: emptyList()
    }

    override suspend fun updateSettings(settings: List<SettingItem>): Result<Unit> = authorized { header ->
        apiService.updateSettings(header, UpdateSettingsRequest(settings))
        Unit
    }

    override suspend fun toggleUserActive(userId: String): Result<Unit> = authorized { header ->
        apiService.toggleUserActive(header, userId)
        Unit
    }

    override suspend fun approveFile(fileId: String): Result<Unit> = authorized { header ->
        apiService.approveFile(header, fileId)
        Unit
    }

    override suspend fun markAttendance(request: MarkAttendanceRequest): Result<Unit> = authorized { header ->
        apiService.markAttendance(header, request)
        Unit
    }

    override suspend fun uploadMarks(request: UploadMarksRequest): Result<Unit> = authorized { header ->
        apiService.uploadMarks(header, request)
        Unit
    }

    override suspend fun createAssignment(request: CreateAssignmentRequest): Result<Unit> = authorized { header ->
        apiService.createAssignment(header, request)
        Unit
    }

    override suspend fun createQuestion(request: CreateQuestionRequest): Result<Unit> = authorized { header ->
        apiService.createQuestion(header, request)
        Unit
    }

    override suspend fun updateQuestion(id: String, request: CreateQuestionRequest): Result<Unit> = authorized { header ->
        apiService.updateQuestion(header, id, request)
        Unit
    }

    override suspend fun deleteQuestion(id: String): Result<Unit> = authorized { header ->
        apiService.deleteQuestion(header, id)
        Unit
    }

    override suspend fun createRubric(request: CreateRubricRequest): Result<Unit> = authorized { header ->
        apiService.createRubric(header, request)
        Unit
    }

    override suspend fun createForumQuestion(title: String, description: String, category: String): Result<Unit> =
        authorized { header ->
            apiService.createForumQuestion(
                header,
                mapOf("title" to title, "description" to description, "category" to category)
            )
            Unit
        }

    override suspend fun answerForumQuestion(questionId: String, answer: String): Result<Unit> = authorized { header ->
        apiService.answerForumQuestion(header, questionId, mapOf("content" to answer))
        Unit
    }

    override suspend fun chatWithAi(message: String): Result<AiChatMessage> = runCatching {
        val header = currentSession()?.authorizationHeader()
        apiService.chatWithAi(header, AiChatRequest(message)).data ?: AiChatMessage(
            role = "assistant",
            content = "No response available."
        )
    }

    override suspend fun uploadFile(
        fileUri: Uri,
        fileName: String,
        category: String,
        subject: String? = null,
        description: String? = null
    ): Result<Unit> = authorized { header ->
        val part = createMultipart(fileUri, fileName)
        apiService.uploadFile(
            header,
            part,
            category = category.asPart(),
            subject = subject?.asPart(),
            description = description?.asPart()
        )
        Unit
    }

    override suspend fun uploadNote(
        fileUri: Uri,
        fileName: String,
        title: String,
        subject: String,
        branch: String,
        semester: String,
        description: String? = null
    ): Result<Unit> = authorized { header ->
        val part = createMultipart(fileUri, fileName)
        apiService.uploadNote(
            header,
            part,
            title = title.asPart(),
            subject = subject.asPart(),
            branch = branch.asPart(),
            semester = semester.asPart(),
            description = description?.asPart()
        )
        Unit
    }

    override suspend fun downloadReceipt(paymentId: String, fileName: String): Result<File> = authorized { header ->
        val response = apiService.downloadReceipt(header, paymentId)
        val body = response.body() ?: error("Receipt download failed")
        fileTransferManager.cacheResponseBody(fileName, body)
    }

    override suspend fun downloadFile(fileId: String, fileName: String): Result<File> = authorized { header ->
        val response = apiService.downloadFile(header, fileId)
        val body = response.body() ?: error("File download failed")
        fileTransferManager.cacheResponseBody(fileName, body)
    }

    override suspend fun downloadProtectedFile(url: String, fileName: String): Result<File> = authorized { header ->
        val response = apiService.downloadFromUrl(absoluteUrl(url), header)
        val body = response.body() ?: error("File download failed")
        fileTransferManager.cacheResponseBody(fileName, body)
    }

    override fun enqueueExternalDownload(url: String, fileName: String): Long =
        fileTransferManager.enqueueDownload(absoluteUrl(url), fileName)

    override fun openCachedFile(file: File, mimeType: String) {
        fileTransferManager.openCachedFile(file, mimeType)
    }

    override fun signOut() {
        sessionStore.clear()
    }

    private suspend fun <T> authorized(block: suspend (String) -> T): Result<T> = runCatching {
        val session = requireSession()
        block(session.authorizationHeader())
    }

    private fun requireSession(): AppSession = currentSession() ?: error("Missing session")

    private suspend fun createMultipart(fileUri: Uri, fileName: String): MultipartBody.Part =
        withContext(Dispatchers.IO) {
            val cacheFile = File(context.cacheDir, fileName)
            context.contentResolver.openInputStream(fileUri)?.use { input ->
                cacheFile.outputStream().use { output -> input.copyTo(output) }
            } ?: error("Unable to read selected file")

            MultipartBody.Part.createFormData(
                "file",
                fileName,
                cacheFile.asRequestBody("application/octet-stream".toMediaTypeOrNull())
            )
        }

    private fun AppSession.authorizationHeader(): String = "Bearer $token"

    private fun optionalAuthorizationHeader(): String? = currentSession()?.authorizationHeader()

    private fun String.asPart() = toRequestBody("text/plain".toMediaTypeOrNull())

    private fun absoluteUrl(url: String): String {
        return if (url.startsWith("http://") || url.startsWith("https://")) {
            url
        } else {
            "$baseUrl/${url.removePrefix("/")}"
        }
    }
}
