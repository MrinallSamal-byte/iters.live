package edu.iter.eduhub

import edu.iter.eduhub.feature.auth.AuthViewModel
import edu.iter.eduhub.core.ui.UiState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun login_emitsSuccessWhenRepositoryReturnsSession() = runTest {
        val viewModel = AuthViewModel(FakePortalDataSource())

        viewModel.login("STU20250001", "Student@123")
        advanceUntilIdle()

        assertTrue(viewModel.loginState.value is UiState.Success)
    }
}
