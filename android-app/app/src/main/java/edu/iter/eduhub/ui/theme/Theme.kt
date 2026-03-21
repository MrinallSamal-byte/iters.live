package edu.iter.eduhub.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.isSystemInDarkTheme

private val LightScheme = lightColorScheme(
    primary = Coral,
    onPrimary = Sand,
    secondary = Mint,
    background = Sand,
    surface = Sand,
    onBackground = Ink,
    onSurface = Ink,
    tertiary = Warning
)

private val DarkScheme = darkColorScheme(
    primary = Coral,
    onPrimary = Ink,
    secondary = Mint,
    background = Ink,
    surface = InkMuted,
    onBackground = Sand,
    onSurface = Sand,
    tertiary = Warning
)

@Composable
fun IterEduHubTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkScheme else LightScheme,
        typography = AppTypography,
        content = content
    )
}
