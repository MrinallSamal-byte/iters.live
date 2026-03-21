package edu.iter.eduhub

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import edu.iter.eduhub.core.model.AppSession
import edu.iter.eduhub.core.model.PublicContent
import edu.iter.eduhub.core.model.SessionUser
import edu.iter.eduhub.core.ui.UiState
import edu.iter.eduhub.feature.main.ConnectPortalScreen
import edu.iter.eduhub.feature.main.PortalViewModel
import org.junit.Rule
import org.junit.Test

class ConnectPortalScreenTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun connectPortalScreen_showsNativePortalActions() {
        val viewModel = PortalViewModel(FakePortalDataSource())
        val session = AppSession(
            user = SessionUser(
                id = "1",
                registration_number = "STU20250001",
                name = "Demo Student",
                role = "student"
            ),
            token = "token"
        )

        composeRule.setContent {
            ConnectPortalScreen(
                publicState = UiState.Success(PublicContent()),
                portalViewModel = viewModel,
                session = session,
                onBack = {}
            )
        }

        composeRule.onNodeWithText("Connect live").assertIsDisplayed()
        composeRule.onNodeWithText("Load backup").assertIsDisplayed()
        composeRule.onNodeWithText("Use demo").assertIsDisplayed()
    }
}
