package edu.iter.eduhub

import edu.iter.eduhub.feature.main.PortalViewModel
import edu.iter.eduhub.core.ui.UiState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PortalViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun init_loadsSnapshotForExistingSession() = runTest {
        val viewModel = PortalViewModel(FakePortalDataSource())
        advanceUntilIdle()
        assertTrue(viewModel.snapshotState.value is UiState.Success)
    }

    @Test
    fun search_updatesState() = runTest {
        val viewModel = PortalViewModel(FakePortalDataSource())
        viewModel.search("attendance")
        advanceUntilIdle()
        assertTrue(viewModel.searchState.value is UiState.Success)
    }

    @Test
    fun connectPortal_updatesPortalDataState() = runTest {
        val viewModel = PortalViewModel(FakePortalDataSource())

        viewModel.connectPortal("STU20250001", "Portal@123")
        advanceUntilIdle()

        assertTrue(viewModel.portalDataState.value is UiState.Success)
    }

    @Test
    fun loadPortalStatus_updatesStatusState() = runTest {
        val viewModel = PortalViewModel(FakePortalDataSource())

        viewModel.loadPortalStatus()
        advanceUntilIdle()

        assertTrue(viewModel.portalStatusState.value is UiState.Success)
    }
}
