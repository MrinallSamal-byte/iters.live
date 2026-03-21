package edu.iter.eduhub

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import edu.iter.eduhub.feature.main.DashboardScreen
import edu.iter.eduhub.feature.main.PortalViewModel
import org.junit.Rule
import org.junit.Test

class DashboardScreenTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun dashboard_rendersMetricFromSnapshot() {
        val viewModel = PortalViewModel(FakePortalDataSource())
        composeRule.setContent {
            DashboardScreen(portalViewModel = viewModel, onNavigate = {})
        }

        composeRule.onNodeWithText("Attendance").assertIsDisplayed()
    }
}
