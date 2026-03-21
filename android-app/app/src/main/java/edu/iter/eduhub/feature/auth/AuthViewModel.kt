package edu.iter.eduhub.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import edu.iter.eduhub.core.data.PortalDataSource
import edu.iter.eduhub.core.model.AppSession
import edu.iter.eduhub.core.model.LoginRequest
import edu.iter.eduhub.core.model.RegistrationRequest
import edu.iter.eduhub.core.ui.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val repository: PortalDataSource
) : ViewModel() {
    private val _loginState = MutableStateFlow<UiState<AppSession>>(UiState.Idle)
    val loginState: StateFlow<UiState<AppSession>> = _loginState.asStateFlow()

    private val _registrationState = MutableStateFlow<UiState<String>>(UiState.Idle)
    val registrationState: StateFlow<UiState<String>> = _registrationState.asStateFlow()

    fun login(registrationNumber: String, password: String) {
        if (registrationNumber.isBlank() || password.isBlank()) {
            _loginState.value = UiState.Error("Registration number and password are required")
            return
        }
        viewModelScope.launch {
            _loginState.value = UiState.Loading
            repository.login(LoginRequest(registrationNumber, password))
                .onSuccess {
                    _loginState.value = UiState.Success(it)
                }
                .onFailure {
                    _loginState.value = UiState.Error(it.message ?: "Login failed")
                }
        }
    }

    fun register(request: RegistrationRequest) {
        viewModelScope.launch {
            _registrationState.value = UiState.Loading
            repository.register(request)
                .onSuccess {
                    _registrationState.value = UiState.Success("Registration successful. Sign in to continue.")
                }
                .onFailure {
                    _registrationState.value = UiState.Error(it.message ?: "Registration failed")
                }
        }
    }
}
