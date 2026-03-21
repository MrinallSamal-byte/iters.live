package edu.iter.eduhub.core.data

import android.net.Uri
import edu.iter.eduhub.core.model.*
import java.io.File

interface PortalDataSource {
    fun currentSession(): AppSession?
    suspend fun login(request: LoginRequest): Result<AppSession>
    suspend fun register(request: RegistrationRequest): Result<LoginPayload>
    suspend fun publicContent(): Result<PublicContent>
    suspend fun portalStatus(): Result<PortalStatusPayload>
    suspend fun portalData(): Result<PortalDataPayload>
    suspend fun connectPortal(registrationNumber: String, password: String): Result<PortalDataPayload>
    suspend fun recoverPortalData(registrationNumber: String?): Result<PortalDataPayload>
    suspend fun loadPortalDemo(): Result<PortalDataPayload>
    suspend fun disconnectPortal(): Result<Unit>
    suspend fun snapshot(): Result<MobileSnapshot>
    suspend fun notifications(): Result<List<NotificationItem>>
    suspend fun markNotificationRead(id: String): Result<Unit>
    suspend fun search(query: String): Result<List<SearchResultItem>>
    suspend fun registerEvent(eventId: String): Result<Unit>
    suspend fun joinClub(clubId: String): Result<Unit>
    suspend fun leaveClub(clubId: String): Result<Unit>
    suspend fun createPayment(request: CreatePaymentRequest): Result<Unit>
    suspend fun createAnnouncement(request: CreateAnnouncementRequest): Result<Unit>
    suspend fun loadSettings(): Result<List<SettingItem>>
    suspend fun updateSettings(settings: List<SettingItem>): Result<Unit>
    suspend fun toggleUserActive(userId: String): Result<Unit>
    suspend fun approveFile(fileId: String): Result<Unit>
    suspend fun markAttendance(request: MarkAttendanceRequest): Result<Unit>
    suspend fun uploadMarks(request: UploadMarksRequest): Result<Unit>
    suspend fun createAssignment(request: CreateAssignmentRequest): Result<Unit>
    suspend fun createQuestion(request: CreateQuestionRequest): Result<Unit>
    suspend fun updateQuestion(id: String, request: CreateQuestionRequest): Result<Unit>
    suspend fun deleteQuestion(id: String): Result<Unit>
    suspend fun createRubric(request: CreateRubricRequest): Result<Unit>
    suspend fun createForumQuestion(title: String, description: String, category: String): Result<Unit>
    suspend fun answerForumQuestion(questionId: String, answer: String): Result<Unit>
    suspend fun chatWithAi(message: String): Result<AiChatMessage>
    suspend fun uploadFile(fileUri: Uri, fileName: String, category: String, subject: String?, description: String?): Result<Unit>
    suspend fun uploadNote(fileUri: Uri, fileName: String, title: String, subject: String, branch: String, semester: String, description: String?): Result<Unit>
    suspend fun downloadReceipt(paymentId: String, fileName: String): Result<File>
    suspend fun downloadFile(fileId: String, fileName: String): Result<File>
    suspend fun downloadProtectedFile(url: String, fileName: String): Result<File>
    fun enqueueExternalDownload(url: String, fileName: String): Long
    fun openCachedFile(file: File, mimeType: String = "application/pdf")
    fun signOut()
}
