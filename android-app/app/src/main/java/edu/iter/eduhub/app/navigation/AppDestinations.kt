package edu.iter.eduhub.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Analytics
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.AutoGraph
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Event
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Rule
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Task
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.ui.graphics.vector.ImageVector
import edu.iter.eduhub.core.model.UserRole

object AppDestinations {
    const val Landing = "landing"
    const val Login = "login"
    const val Register = "register"
    const val Creator = "creator"
    const val ConnectPortal = "connectPortal"
    const val Dashboard = "dashboard"
    const val Notifications = "notifications"
    const val Search = "search"
    const val Profile = "profile"
    const val FileCenter = "fileCenter"

    const val StudentAttendance = "studentAttendance"
    const val StudentMarks = "studentMarks"
    const val StudentTimetable = "studentTimetable"
    const val StudentNotes = "studentNotes"
    const val StudentAdmit = "studentAdmit"
    const val StudentEvents = "studentEvents"
    const val StudentClubs = "studentClubs"
    const val StudentHostel = "studentHostel"
    const val StudentForum = "studentForum"
    const val StudentAi = "studentAi"
    const val StudentPaymentHistory = "studentPaymentHistory"
    const val StudentPaymentDetail = "studentPaymentDetail"
    const val StudentPaymentMake = "studentPaymentMake"

    const val TeacherAttendance = "teacherAttendance"
    const val TeacherMarks = "teacherMarks"
    const val TeacherAssignments = "teacherAssignments"
    const val TeacherNotes = "teacherNotes"
    const val TeacherQuestionBank = "teacherQuestionBank"
    const val TeacherRubrics = "teacherRubrics"
    const val TeacherStudents = "teacherStudents"

    const val AdminUsers = "adminUsers"
    const val AdminApprovals = "adminApprovals"
    const val AdminAnalytics = "adminAnalytics"
    const val AdminAnnouncements = "adminAnnouncements"
    const val AdminDepartments = "adminDepartments"
    const val AdminSettings = "adminSettings"

    private val publicRoutes = setOf(
        Landing,
        Login,
        Register,
        Creator,
        ConnectPortal
    )

    private val authenticatedRoutes = setOf(
        Dashboard,
        Notifications,
        Search,
        Profile,
        FileCenter,
        StudentAttendance,
        StudentMarks,
        StudentTimetable,
        StudentNotes,
        StudentAdmit,
        StudentEvents,
        StudentClubs,
        StudentHostel,
        StudentForum,
        StudentAi,
        StudentPaymentHistory,
        StudentPaymentDetail,
        StudentPaymentMake,
        TeacherAttendance,
        TeacherMarks,
        TeacherAssignments,
        TeacherNotes,
        TeacherQuestionBank,
        TeacherRubrics,
        TeacherStudents,
        AdminUsers,
        AdminApprovals,
        AdminAnalytics,
        AdminAnnouncements,
        AdminDepartments,
        AdminSettings
    )

    fun isPublicRoute(route: String?): Boolean = route in publicRoutes

    fun isAuthenticatedRoute(route: String?): Boolean {
        if (route == null) {
            return false
        }
        return route in authenticatedRoutes || route.startsWith(StudentPaymentDetail)
    }

    fun allowedRoles(route: String?): Set<UserRole> = when {
        route == null -> emptySet()
        route in publicRoutes -> emptySet()
        route in setOf(Dashboard, Notifications, Search, Profile, FileCenter) -> UserRole.entries.toSet()
        route in setOf(
            StudentAttendance,
            StudentMarks,
            StudentTimetable,
            StudentNotes,
            StudentAdmit,
            StudentEvents,
            StudentClubs,
            StudentHostel,
            StudentForum,
            StudentAi,
            StudentPaymentHistory,
            StudentPaymentMake
        ) || route?.startsWith(StudentPaymentDetail) == true -> setOf(UserRole.STUDENT)
        route in setOf(
            TeacherAttendance,
            TeacherMarks,
            TeacherAssignments,
            TeacherNotes,
            TeacherQuestionBank,
            TeacherRubrics,
            TeacherStudents
        ) -> setOf(UserRole.TEACHER)
        route in setOf(
            AdminUsers,
            AdminApprovals,
            AdminAnalytics,
            AdminAnnouncements,
            AdminDepartments,
            AdminSettings
        ) -> setOf(UserRole.ADMIN)
        else -> emptySet()
    }

    fun isAllowed(route: String?, role: UserRole?): Boolean {
        if (isPublicRoute(route)) {
            return true
        }
        val allowed = allowedRoles(route)
        return role != null && role in allowed
    }

    fun resolveWebPath(path: String?): String? {
        val normalized = path
            ?.substringBefore('?')
            ?.substringBefore('#')
            ?.trim()
            ?.ifBlank { "/" }
            ?: return null

        return when (normalized) {
            "/" -> Landing
            "/login.html" -> Login
            "/register.html" -> Register
            "/creator.html" -> Creator
            "/connect-portal.html" -> ConnectPortal
            "/dashboard/student.html" -> Dashboard
            "/dashboard/student-attendance.html" -> StudentAttendance
            "/dashboard/student-marks.html" -> StudentMarks
            "/dashboard/student-timetable.html" -> StudentTimetable
            "/dashboard/student-notes.html" -> StudentNotes
            "/dashboard/student-admit-card.html" -> StudentAdmit
            "/dashboard/student-events.html" -> StudentEvents
            "/dashboard/student-clubs.html" -> StudentClubs
            "/dashboard/student-hostel-menu.html" -> StudentHostel
            "/dashboard/student-forum.html" -> StudentForum
            "/dashboard/student-ai-assistant.html" -> StudentAi
            "/dashboard/student-payment-history.html" -> StudentPaymentHistory
            "/dashboard/student-payment-details.html" -> StudentPaymentDetail
            "/dashboard/student-payment-make.html" -> StudentPaymentMake
            "/dashboard/teacher.html" -> Dashboard
            "/dashboard/teacher-attendance.html" -> TeacherAttendance
            "/dashboard/teacher-marks.html" -> TeacherMarks
            "/dashboard/teacher-assignments.html" -> TeacherAssignments
            "/dashboard/teacher-notes.html" -> TeacherNotes
            "/dashboard/teacher-question-bank.html" -> TeacherQuestionBank
            "/dashboard/teacher-rubric-creator.html" -> TeacherRubrics
            "/dashboard/teacher-students.html" -> TeacherStudents
            "/dashboard/admin.html" -> Dashboard
            "/dashboard/admin-users.html" -> AdminUsers
            "/dashboard/admin-approvals.html" -> AdminApprovals
            "/dashboard/admin-analytics.html" -> AdminAnalytics
            "/dashboard/admin-announcements.html" -> AdminAnnouncements
            "/dashboard/admin-departments.html" -> AdminDepartments
            "/dashboard/admin-settings.html" -> AdminSettings
            else -> null
        }
    }
}

data class DrawerDestination(
    val route: String,
    val title: String,
    val icon: ImageVector,
    val roles: Set<UserRole>
)

val DrawerDestinations = listOf(
    DrawerDestination(AppDestinations.Dashboard, "Dashboard", Icons.Outlined.Dashboard, UserRole.entries.toSet()),
    DrawerDestination(AppDestinations.Notifications, "Notifications", Icons.Outlined.Notifications, UserRole.entries.toSet()),
    DrawerDestination(AppDestinations.Search, "Search", Icons.Outlined.Search, UserRole.entries.toSet()),
    DrawerDestination(AppDestinations.Profile, "Profile", Icons.Outlined.Person, UserRole.entries.toSet()),
    DrawerDestination(AppDestinations.FileCenter, "Files", Icons.Outlined.UploadFile, UserRole.entries.toSet()),
    DrawerDestination(AppDestinations.ConnectPortal, "Portal Sync", Icons.Outlined.Hub, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentAttendance, "Attendance", Icons.Outlined.Verified, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentMarks, "Marks", Icons.Outlined.AutoGraph, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentTimetable, "Timetable", Icons.Outlined.Schedule, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentNotes, "Notes", Icons.Outlined.MenuBook, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentAdmit, "Admit Card", Icons.Outlined.Badge, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentEvents, "Events", Icons.Outlined.Event, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentClubs, "Clubs", Icons.Outlined.Groups, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentHostel, "Hostel Menu", Icons.Outlined.Home, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentForum, "Forum", Icons.Outlined.Forum, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentAi, "AI Assistant", Icons.Outlined.Psychology, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentPaymentHistory, "Payments", Icons.Outlined.Payments, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.StudentPaymentMake, "Make Payment", Icons.Outlined.CreditCard, setOf(UserRole.STUDENT)),
    DrawerDestination(AppDestinations.TeacherAttendance, "Mark Attendance", Icons.Outlined.Verified, setOf(UserRole.TEACHER)),
    DrawerDestination(AppDestinations.TeacherMarks, "Upload Marks", Icons.Outlined.AutoGraph, setOf(UserRole.TEACHER)),
    DrawerDestination(AppDestinations.TeacherAssignments, "Assignments", Icons.Outlined.Assignment, setOf(UserRole.TEACHER)),
    DrawerDestination(AppDestinations.TeacherNotes, "Material Uploads", Icons.Outlined.Article, setOf(UserRole.TEACHER)),
    DrawerDestination(AppDestinations.TeacherQuestionBank, "Question Bank", Icons.Outlined.School, setOf(UserRole.TEACHER)),
    DrawerDestination(AppDestinations.TeacherRubrics, "Rubric Creator", Icons.Outlined.Rule, setOf(UserRole.TEACHER)),
    DrawerDestination(AppDestinations.TeacherStudents, "Students", Icons.Outlined.People, setOf(UserRole.TEACHER)),
    DrawerDestination(AppDestinations.AdminUsers, "Users", Icons.Outlined.People, setOf(UserRole.ADMIN)),
    DrawerDestination(AppDestinations.AdminApprovals, "Approvals", Icons.Outlined.Task, setOf(UserRole.ADMIN)),
    DrawerDestination(AppDestinations.AdminAnalytics, "Analytics", Icons.Outlined.Analytics, setOf(UserRole.ADMIN)),
    DrawerDestination(AppDestinations.AdminAnnouncements, "Announcements", Icons.Outlined.Description, setOf(UserRole.ADMIN)),
    DrawerDestination(AppDestinations.AdminDepartments, "Departments", Icons.Outlined.Hub, setOf(UserRole.ADMIN)),
    DrawerDestination(AppDestinations.AdminSettings, "Settings", Icons.Outlined.Settings, setOf(UserRole.ADMIN))
)
