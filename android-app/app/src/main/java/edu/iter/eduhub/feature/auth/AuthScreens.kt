package edu.iter.eduhub.feature.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import edu.iter.eduhub.core.model.AppSession
import edu.iter.eduhub.core.model.RegistrationRequest
import edu.iter.eduhub.core.ui.ErrorState
import edu.iter.eduhub.core.ui.LoadingState
import edu.iter.eduhub.core.ui.UiState

@Composable
fun AuthScreen(
    authViewModel: AuthViewModel,
    onLoggedIn: (AppSession) -> Unit,
    onRegister: () -> Unit
) {
    val loginState by authViewModel.loginState.collectAsStateWithLifecycle()
    var registrationNumber by remember { mutableStateOf("STU20250001") }
    var password by remember { mutableStateOf("Student@123") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .testTag("login_screen"),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Native ITER EduHub", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Android 10+ Compose client for public, student, teacher, and admin flows.")
        Spacer(modifier = Modifier.height(24.dp))
        Card {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = registrationNumber,
                    onValueChange = { registrationNumber = it },
                    label = { Text("Registration number") },
                    modifier = Modifier.fillMaxWidth().testTag("login_registration")
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    modifier = Modifier.fillMaxWidth().testTag("login_password"),
                    visualTransformation = PasswordVisualTransformation()
                )
                Button(
                    onClick = { authViewModel.login(registrationNumber, password) },
                    modifier = Modifier.fillMaxWidth().testTag("login_submit")
                ) {
                    Text("Sign in")
                }
                TextButton(onClick = onRegister) {
                    Text("Create student account")
                }
                when (val state = loginState) {
                    UiState.Idle -> Text("Demo accounts remain supported when the backend exposes local-demo auth.")
                    UiState.Loading -> LoadingState(message = "Signing in…")
                    is UiState.Error -> ErrorState(state.message)
                    is UiState.Success -> LaunchedEffect(state.value) { onLoggedIn(state.value) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterScreen(
    authViewModel: AuthViewModel,
    onBack: () -> Unit
) {
    val registrationState by authViewModel.registrationState.collectAsStateWithLifecycle()
    var name by remember { mutableStateOf("") }
    var registrationNumber by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var department by remember { mutableStateOf("CSE") }
    var year by remember { mutableStateOf("1") }
    var section by remember { mutableStateOf("A") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Student registration", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Creates a backend account when registration is enabled on the server.")
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = registrationNumber, onValueChange = { registrationNumber = it }, label = { Text("Registration number") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation()
        )
        OutlinedTextField(value = department, onValueChange = { department = it }, label = { Text("Department") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(
            value = year,
            onValueChange = { year = it.filter(Char::isDigit) },
            label = { Text("Year") },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
        )
        OutlinedTextField(value = section, onValueChange = { section = it }, label = { Text("Section") }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = {
                authViewModel.register(
                    RegistrationRequest(
                        name = name,
                        registration_number = registrationNumber,
                        email = email,
                        password = password,
                        department = department,
                        year = year.toIntOrNull() ?: 1,
                        section = section
                    )
                )
            }) {
                Text("Submit")
            }
            TextButton(onClick = onBack) { Text("Back") }
        }
        when (val state = registrationState) {
            UiState.Idle -> Unit
            UiState.Loading -> LoadingState("Submitting registration…")
            is UiState.Error -> ErrorState(state.message)
            is UiState.Success -> Text(state.value)
        }
    }
}
