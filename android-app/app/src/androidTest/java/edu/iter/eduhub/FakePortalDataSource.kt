package edu.iter.eduhub

import android.net.Uri
import edu.iter.eduhub.core.data.PortalDataSource
import edu.iter.eduhub.core.model.*
import java.io.File

class FakePortalDataSource(
    private val session: AppSession? = AppSession(
        user = SessionUser(id = "1", name = "Demo Student", role = "student"),
        token = "token"
    ),
    private val snapshot: MobileSnapshot = MobileSnapshot(
        user = SessionUser(id = "1", name = "Demo Student", role = "student"),
        dashboard = DashboardPayload(metrics = listOf(MetricItem("Attendance", "89%"))),
        student = StudentPayload(),
        shared = SharedPayload()
    ),
    private val portalStatus: PortalStatusPayload = PortalStatusPayload(portalConnected = true, isVerified = true),
    private val portalData: PortalDataPayload = PortalDataPayload(
        profile = PortalProfile(name = "Demo Student", registration_number = "STU20250001"),
        marks = listOf(PortalMark(subject = "Data Structures")),
        attendance = listOf(PortalAttendanceSummary(subject = "Data Structures")),
        timetable = listOf(PortalTimetableEntry(subject = "Data Structures")),
        portalConnected = true,
        isVerified = true,
        dataSource = "live_portal"
    )
) : PortalDataSource {
    override fun currentSession(): AppSession? = session
    override suspend fun login(request: LoginRequest): Result<AppSession> = Result.success(session!!)
    override suspend fun register(request: RegistrationRequest): Result<LoginPayload> = Result.success(LoginPayload(user = session!!.user))
    override suspend fun publicContent(): Result<PublicContent> = Result.success(PublicContent())
    override suspend fun portalStatus(): Result<PortalStatusPayload> = Result.success(portalStatus)
    override suspend fun portalData(): Result<PortalDataPayload> = Result.success(portalData)
    override suspend fun connectPortal(registrationNumber: String, password: String): Result<PortalDataPayload> = Result.success(portalData)
    override suspend fun recoverPortalData(registrationNumber: String?): Result<PortalDataPayload> = Result.success(portalData)
    override suspend fun loadPortalDemo(): Result<PortalDataPayload> = Result.success(portalData.copy(mode = "demo", portalConnected = false, isVerified = false, dataSource = "demo"))
    override suspend fun disconnectPortal(): Result<Unit> = Result.success(Unit)
    override suspend fun snapshot(): Result<MobileSnapshot> = Result.success(snapshot)
    override suspend fun notifications(): Result<List<NotificationItem>> = Result.success(emptyList())
    override suspend fun markNotificationRead(id: String): Result<Unit> = Result.success(Unit)
    override suspend fun search(query: String): Result<List<SearchResultItem>> = Result.success(listOf(SearchResultItem(type = "file", name = query)))
    override suspend fun registerEvent(eventId: String): Result<Unit> = Result.success(Unit)
    override suspend fun joinClub(clubId: String): Result<Unit> = Result.success(Unit)
    override suspend fun leaveClub(clubId: String): Result<Unit> = Result.success(Unit)
    override suspend fun createPayment(request: CreatePaymentRequest): Result<Unit> = Result.success(Unit)
    override suspend fun createAnnouncement(request: CreateAnnouncementRequest): Result<Unit> = Result.success(Unit)
    override suspend fun loadSettings(): Result<List<SettingItem>> = Result.success(emptyList())
    override suspend fun updateSettings(settings: List<SettingItem>): Result<Unit> = Result.success(Unit)
    override suspend fun toggleUserActive(userId: String): Result<Unit> = Result.success(Unit)
    override suspend fun approveFile(fileId: String): Result<Unit> = Result.success(Unit)
    override suspend fun markAttendance(request: MarkAttendanceRequest): Result<Unit> = Result.success(Unit)
    override suspend fun uploadMarks(request: UploadMarksRequest): Result<Unit> = Result.success(Unit)
    override suspend fun createAssignment(request: CreateAssignmentRequest): Result<Unit> = Result.success(Unit)
    override suspend fun createQuestion(request: CreateQuestionRequest): Result<Unit> = Result.success(Unit)
    override suspend fun updateQuestion(id: String, request: CreateQuestionRequest): Result<Unit> = Result.success(Unit)
    override suspend fun deleteQuestion(id: String): Result<Unit> = Result.success(Unit)
    override suspend fun createRubric(request: CreateRubricRequest): Result<Unit> = Result.success(Unit)
    override suspend fun createForumQuestion(title: String, description: String, category: String): Result<Unit> = Result.success(Unit)
    override suspend fun answerForumQuestion(questionId: String, answer: String): Result<Unit> = Result.success(Unit)
    override suspend fun chatWithAi(message: String): Result<AiChatMessage> = Result.success(AiChatMessage("assistant", "ok"))
    override suspend fun uploadFile(fileUri: Uri, fileName: String, category: String, subject: String?, description: String?): Result<Unit> = Result.success(Unit)
    override suspend fun uploadNote(fileUri: Uri, fileName: String, title: String, subject: String, branch: String, semester: String, description: String?): Result<Unit> = Result.success(Unit)
    override suspend fun downloadReceipt(paymentId: String, fileName: String): Result<File> = Result.failure(UnsupportedOperationException())
    override suspend fun downloadFile(fileId: String, fileName: String): Result<File> = Result.failure(UnsupportedOperationException())
    override suspend fun downloadProtectedFile(url: String, fileName: String): Result<File> = Result.failure(UnsupportedOperationException())
    override fun enqueueExternalDownload(url: String, fileName: String): Long = 0L
    override fun openCachedFile(file: File, mimeType: String) = Unit
    override fun signOut() = Unit
}
