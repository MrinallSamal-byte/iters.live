package edu.iter.eduhub

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import edu.iter.eduhub.app.EduHubApplication
import edu.iter.eduhub.app.IterEduHubApp
import edu.iter.eduhub.app.navigation.AppDestinations
import edu.iter.eduhub.ui.theme.IterEduHubTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val application = application as EduHubApplication
        val initialRoute = AppDestinations.resolveWebPath(intent?.data?.path)
        setContent {
            IterEduHubTheme {
                IterEduHubApp(
                    application = application,
                    initialRoute = initialRoute
                )
            }
        }
    }
}
