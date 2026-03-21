package edu.iter.eduhub

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import edu.iter.eduhub.feature.auth.AuthScreen
import edu.iter.eduhub.feature.auth.AuthViewModel
import org.junit.Rule
import org.junit.Test

class LoginScreenTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun loginScreen_showsCoreControls() {
        composeRule.setContent {
            AuthScreen(
                authViewModel = AuthViewModel(FakePortalDataSource()),
                onLoggedIn = {},
                onRegister = {}
            )
        }

        composeRule.onNodeWithTag("login_screen").assertIsDisplayed()
        composeRule.onNodeWithTag("login_registration").assertIsDisplayed()
        composeRule.onNodeWithTag("login_password").assertIsDisplayed()
        composeRule.onNodeWithTag("login_submit").assertIsDisplayed()
    }
}
