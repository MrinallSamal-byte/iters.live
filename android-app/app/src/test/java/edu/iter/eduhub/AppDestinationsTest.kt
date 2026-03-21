package edu.iter.eduhub

import edu.iter.eduhub.app.navigation.AppDestinations
import edu.iter.eduhub.core.model.UserRole
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppDestinationsTest {
    @Test
    fun resolveWebPath_mapsPublicAndRoleRoutes() {
        assertEquals(AppDestinations.Login, AppDestinations.resolveWebPath("/login.html"))
        assertEquals(AppDestinations.StudentAttendance, AppDestinations.resolveWebPath("/dashboard/student-attendance.html"))
        assertEquals(AppDestinations.StudentPaymentDetail, AppDestinations.resolveWebPath("/dashboard/student-payment-details.html"))
        assertEquals(AppDestinations.AdminUsers, AppDestinations.resolveWebPath("/dashboard/admin-users.html"))
    }

    @Test
    fun isAllowed_enforcesRoleAccess() {
        assertTrue(AppDestinations.isAllowed(AppDestinations.StudentMarks, UserRole.STUDENT))
        assertFalse(AppDestinations.isAllowed(AppDestinations.StudentMarks, UserRole.TEACHER))
        assertTrue(AppDestinations.isAllowed(AppDestinations.Login, null))
    }
}
