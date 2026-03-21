package edu.iter.eduhub.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class ApiResponse<T>(
    val success: Boolean = false,
    val message: String? = null,
    val status: String? = null,
    val data: T? = null,
    val errors: List<ApiError> = emptyList()
)

@Serializable
data class ApiError(
    val msg: String? = null,
    val message: String? = null,
    val path: String? = null
)

@Serializable
enum class UserRole {
    @SerialName("student")
    STUDENT,

    @SerialName("teacher")
    TEACHER,

    @SerialName("admin")
    ADMIN;

    companion object {
        fun fromValue(value: String?): UserRole = entries.firstOrNull {
            it.name.equals(value, ignoreCase = true)
        } ?: STUDENT
    }
}

@Serializable
data class SessionUser(
    val id: String,
    val registration_number: String? = null,
    val name: String,
    val email: String? = null,
    val role: String,
    val department: String? = null,
    val year: Int? = null,
    val section: String? = null,
    val semester: String? = null,
    val phone_number: String? = null,
    val profile_picture: String? = null,
    val is_active: Boolean = true
) {
    val userRole: UserRole
        get() = UserRole.fromValue(role)
}

@Serializable
data class LoginRequest(
    val registration_number: String,
    val password: String
)

@Serializable
data class LoginPayload(
    val user: SessionUser,
    val accessToken: String? = null,
    val appAccessToken: String? = null,
    val refreshToken: String? = null,
    val demoMode: Boolean = false,
    val authMode: String? = null
)

@Serializable
data class AppSession(
    val user: SessionUser,
    val token: String,
    val demoMode: Boolean = false,
    val authMode: String? = null
)

@Serializable
data class RegistrationRequest(
    val name: String,
    val registration_number: String,
    val email: String,
    val password: String,
    val department: String,
    val year: Int,
    val section: String
)

@Serializable
data class PortalStatusPayload(
    val portalConnected: Boolean = false,
    val isVerified: Boolean = false,
    val lastSynced: String? = null,
    val portalEnabled: Boolean = true,
    val message: String? = null
)

@Serializable
data class PortalDataPayload(
    val mode: String? = null,
    val profile: PortalProfile = PortalProfile(),
    val marks: List<PortalMark> = emptyList(),
    val attendance: List<PortalAttendanceSummary> = emptyList(),
    val timetable: List<PortalTimetableEntry> = emptyList(),
    val notifications: List<PortalNotificationRecord> = emptyList(),
    val isVerified: Boolean = false,
    val portalConnected: Boolean = false,
    val dataSource: String? = null,
    val portalEnabled: Boolean? = null,
    val warning: String? = null
)

@Serializable
data class PortalProfile(
    val name: String? = null,
    val registration_number: String? = null,
    val email: String? = null,
    val department: String? = null,
    val year: JsonElement? = null,
    val section: String? = null,
    val semester: JsonElement? = null,
    val phone: String? = null,
    val father_name: String? = null,
    val mother_name: String? = null,
    val hostel: String? = null,
    val photo_url: String? = null
)

@Serializable
data class PortalMark(
    val subject: String? = null,
    val subject_code: String? = null,
    val marks: JsonElement? = null,
    val grade: String? = null,
    val exam_type: String? = null,
    val total_marks: JsonElement? = null,
    val credits: JsonElement? = null
)

@Serializable
data class PortalAttendanceSummary(
    val subject: String? = null,
    val subject_code: String? = null,
    val attended: JsonElement? = null,
    val total: JsonElement? = null,
    val percentage: JsonElement? = null,
    val teacher: String? = null
)

@Serializable
data class PortalTimetableEntry(
    val day: String? = null,
    val time_slot: String? = null,
    val subject: String? = null,
    val teacher: String? = null,
    val room: String? = null
)

@Serializable
data class PortalNotificationRecord(
    val title: String? = null,
    val message: String? = null,
    val date: String? = null,
    val type: String? = null,
    val priority: String? = null
)

@Serializable
data class PortalCredentialsRequest(
    val reg_number: String,
    val password: String
)

@Serializable
data class PortalLookupRequest(
    val reg_number: String? = null
)

@Serializable
data class PublicContent(
    val landing: PublicPage = PublicPage(),
    val creator: PublicPage = PublicPage(title = "Creator"),
    val connectPortal: PublicPage = PublicPage(title = "Connect Portal")
)

@Serializable
data class PublicPage(
    val title: String = "",
    val subtitle: String? = null,
    val sections: List<ContentSection> = emptyList()
)

@Serializable
data class ContentSection(
    val title: String,
    val body: String,
    val highlight: String? = null
)

@Serializable
data class MobileSnapshot(
    val generatedAt: String? = null,
    val user: SessionUser,
    val navigation: List<NavigationItem> = emptyList(),
    val dashboard: DashboardPayload = DashboardPayload(),
    val notifications: NotificationSummary = NotificationSummary(),
    val portal: PortalSnapshotInfo = PortalSnapshotInfo(),
    val student: StudentPayload? = null,
    val teacher: TeacherPayload? = null,
    val admin: AdminPayload? = null,
    val shared: SharedPayload = SharedPayload()
)

@Serializable
data class NavigationItem(
    val route: String,
    val label: String,
    val role: String? = null,
    val description: String? = null
)

@Serializable
data class DashboardPayload(
    val heroTitle: String = "ITER EduHub",
    val heroSubtitle: String? = null,
    val metrics: List<MetricItem> = emptyList(),
    val quickLinks: List<QuickLink> = emptyList()
)

@Serializable
data class MetricItem(
    val title: String,
    val value: String,
    val detail: String? = null
)

@Serializable
data class QuickLink(
    val route: String,
    val title: String,
    val description: String? = null
)

@Serializable
data class NotificationSummary(
    val unreadCount: Int = 0,
    val items: List<NotificationItem> = emptyList()
)

@Serializable
data class PortalSnapshotInfo(
    val enabled: Boolean = true,
    val connected: Boolean = false,
    val verified: Boolean = false,
    val lastSynced: String? = null,
    val dataSource: String? = null
)

@Serializable
data class NotificationItem(
    val id: String,
    val title: String,
    val message: String,
    val type: String = "info",
    val is_read: Boolean = false,
    val created_at: String? = null,
    val link: String? = null
)

@Serializable
data class NotificationListResponse(
    val success: Boolean,
    val notifications: List<NotificationItem> = emptyList(),
    val unreadCount: Int = 0
)

@Serializable
data class SharedPayload(
    val fileHub: List<DocumentItem> = emptyList(),
    val subjects: List<SubjectItem> = emptyList(),
    val searchHints: List<String> = emptyList()
)

@Serializable
data class StudentPayload(
    val attendance: AttendancePayload = AttendancePayload(),
    val marks: MarksPayload = MarksPayload(),
    val timetable: List<TimetableItem> = emptyList(),
    val notes: List<DocumentItem> = emptyList(),
    val admitCard: AdmitCardPayload? = null,
    val events: List<EventItem> = emptyList(),
    val clubs: List<ClubItem> = emptyList(),
    val hostelMenu: List<HostelMenuItem> = emptyList(),
    val forum: List<ForumQuestion> = emptyList(),
    val aiPrompts: List<String> = emptyList(),
    val payments: List<PaymentItem> = emptyList()
)

@Serializable
data class AttendancePayload(
    val records: List<AttendanceRecord> = emptyList(),
    val summary: List<AttendanceSummaryItem> = emptyList()
)

@Serializable
data class AttendanceRecord(
    val id: String? = null,
    val subject: String,
    val date: String,
    val status: String,
    val remarks: String? = null
)

@Serializable
data class AttendanceSummaryItem(
    val subject: String,
    val subject_code: String? = null,
    val total_classes: Int = 0,
    val present_count: Int = 0,
    val percentage: Double? = null
)

@Serializable
data class MarksPayload(
    val marks: List<MarkRecord> = emptyList(),
    val summary: List<MarkSummaryItem> = emptyList(),
    val cgpa: Double? = null
)

@Serializable
data class MarkRecord(
    val id: String? = null,
    val subject: String,
    val exam_type: String,
    val marks_obtained: Double,
    val total_marks: Double,
    val exam_date: String? = null,
    val remarks: String? = null
)

@Serializable
data class MarkSummaryItem(
    val subject: String,
    val exam_type: String? = null,
    val avg_marks: Double = 0.0,
    val avg_total: Double = 100.0
)

@Serializable
data class TimetableItem(
    val id: String? = null,
    val day_of_week: String,
    val start_time: String,
    val end_time: String? = null,
    val subject: String,
    val room: String? = null,
    val teacher_name: String? = null
)

@Serializable
data class DocumentItem(
    val id: String,
    val title: String,
    val subject: String? = null,
    val type: String? = null,
    val description: String? = null,
    val url: String? = null,
    val downloadUrl: String? = null,
    val fileName: String? = null,
    val sizeLabel: String? = null
)

@Serializable
data class AdmitCardPayload(
    val exam_name: String,
    val exam_code: String? = null,
    val exam_date: String? = null,
    val public_url: String? = null,
    val download_url: String? = null
)

@Serializable
data class EventItem(
    val id: String,
    val title: String,
    val category: String,
    val description: String? = null,
    val event_date: String? = null,
    val event_time: String? = null,
    val location: String? = null,
    val registration_count: Int? = null
)

@Serializable
data class ClubItem(
    val id: String,
    val name: String,
    val category: String,
    val description: String? = null,
    val members: Int? = null,
    val events: Int? = null,
    val joined: Boolean = false
)

@Serializable
data class HostelMenuItem(
    val id: String? = null,
    val date: String,
    val meal_type: String,
    val menu_items: String
)

@Serializable
data class ForumQuestion(
    val id: String,
    val title: String,
    val description: String = "",
    val category: String? = null,
    val status: String? = null,
    val views: Int? = null,
    val upvotes: Int? = null,
    val author_name: String? = null,
    val answer_count: Int? = null,
    val created_at: String? = null
)

@Serializable
data class PaymentItem(
    val id: String,
    val paymentId: String,
    val amount: Double,
    val category: String,
    val semester: String,
    val status: String,
    val transactionId: String? = null,
    val paymentDate: String? = null,
    val description: String? = null
)

@Serializable
data class TeacherPayload(
    val students: List<StudentRosterItem> = emptyList(),
    val assignments: List<AssignmentItem> = emptyList(),
    val notes: List<DocumentItem> = emptyList(),
    val questionBank: List<QuestionBankItem> = emptyList(),
    val rubrics: List<RubricItem> = emptyList()
)

@Serializable
data class StudentRosterItem(
    val id: String,
    val name: String,
    val registration_number: String,
    val email: String? = null,
    val department: String? = null,
    val year: Int? = null,
    val section: String? = null,
    val attendance_percent: Double? = null,
    val avg_marks: Double? = null
)

@Serializable
data class AssignmentItem(
    val id: String,
    val title: String,
    val subject: String,
    val description: String? = null,
    val deadline: String? = null,
    val total_marks: Double? = null,
    val submission_status: String? = null,
    val submissions_count: Int? = null,
    val pending_count: Int? = null
)

@Serializable
data class QuestionBankItem(
    val id: String,
    val subject_id: Int? = null,
    val question_text: String,
    val question_type: String = "mcq",
    val difficulty: String,
    val topic: String? = null,
    val marks: Int? = null
)

@Serializable
data class RubricItem(
    val id: String,
    val assignment_id: String? = null,
    val name: String,
    val description: String? = null,
    val criteria: List<RubricCriterion> = emptyList()
)

@Serializable
data class RubricCriterion(
    val name: String,
    val description: String? = null,
    val max_points: Int = 0
)

@Serializable
data class AdminPayload(
    val users: List<AdminUserItem> = emptyList(),
    val approvals: List<ApprovalItem> = emptyList(),
    val analytics: List<MetricItem> = emptyList(),
    val announcements: List<AnnouncementItem> = emptyList(),
    val departments: List<DepartmentItem> = emptyList(),
    val settings: List<SettingItem> = emptyList()
)

@Serializable
data class AdminUserItem(
    val id: String,
    val registration_number: String? = null,
    val name: String,
    val email: String? = null,
    val role: String,
    val department: String? = null,
    val is_active: Boolean = true
)

@Serializable
data class ApprovalItem(
    val id: String,
    val type: String,
    val title: String,
    val uploaded_by: String? = null,
    val department: String? = null,
    val created_at: String? = null
)

@Serializable
data class AnnouncementItem(
    val id: String,
    val title: String,
    val content: String,
    val priority: String = "normal",
    val target_audience: String = "all",
    val status: String = "active",
    val created_at: String? = null,
    val department: String? = null
)

@Serializable
data class DepartmentItem(
    val code: String,
    val name: String,
    val hod: String? = null,
    val total_students: Int = 0,
    val total_teachers: Int = 0,
    val active_courses: Int = 0
)

@Serializable
data class SettingItem(
    val key: String,
    val value: String,
    val description: String? = null
)

@Serializable
data class SubjectItem(
    val id: Int,
    val name: String,
    val code: String? = null
)

@Serializable
data class SearchResponse(
    val success: Boolean,
    val results: List<SearchResultItem> = emptyList()
)

@Serializable
data class SearchResultItem(
    val id: String? = null,
    val type: String,
    val name: String,
    val description: String? = null,
    val subject: String? = null
)

@Serializable
data class CreatePaymentRequest(
    val amount: Double,
    val semester: String,
    val category: String,
    val paymentMethod: String,
    val description: String
)

@Serializable
data class CreateAnnouncementRequest(
    val title: String,
    val content: String,
    val priority: String,
    val target_audience: String,
    val department: String? = null
)

@Serializable
data class UpdateSettingsRequest(
    val settings: List<SettingItem>
)

@Serializable
data class MarkAttendanceRequest(
    val student_id: String,
    val subject: String,
    val date: String,
    val status: String,
    val remarks: String? = null
)

@Serializable
data class UploadMarksRequest(
    val student_id: String,
    val subject: String,
    val exam_type: String,
    val marks_obtained: Double,
    val total_marks: Double,
    val exam_date: String,
    val remarks: String? = null
)

@Serializable
data class CreateAssignmentRequest(
    val title: String,
    val description: String,
    val subject: String,
    val department: String,
    val year: Int,
    val total_marks: Double,
    val deadline: String
)

@Serializable
data class CreateQuestionRequest(
    val subject_id: Int,
    val question_text: String,
    val question_type: String = "mcq",
    val difficulty: String,
    val topic: String? = null,
    val marks: Int = 1
)

@Serializable
data class CreateRubricRequest(
    val assignment_id: Int,
    val name: String,
    val criteria: List<RubricCriterion>
)

@Serializable
data class AiChatRequest(
    val message: String,
    val context: String? = null
)

@Serializable
data class AiChatMessage(
    val role: String,
    val content: String
)
