import { captureHandledError } from "@/services/errorReporting";
import type { ErrorInfo, PropsWithChildren, ReactNode } from "react";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type AppErrorBoundaryProps = PropsWithChildren<{
  area: "application-root" | "reader";
  fallbackTitle: string;
  fallbackMessage: string;
  onExit?: () => void;
}>;

type AppErrorBoundaryState = { error: Error | null };

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureHandledError(error, this.props.area, {
      hasComponentStack: Boolean(info.componentStack),
    });
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>{this.props.fallbackTitle}</Text>
          <Text style={styles.message}>{this.props.fallbackMessage}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={this.reset}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
          {this.props.onExit ? (
            <Pressable
              accessibilityRole="button"
              onPress={this.props.onExit}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>Return to library</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F5EF",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  title: { color: "#20241E", fontSize: 22, fontWeight: "700" },
  message: { marginTop: 10, color: "#60685B", fontSize: 15, lineHeight: 22 },
  primaryButton: {
    marginTop: 24,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#639922",
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    marginTop: 10,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  secondaryText: { color: "#4F7D1A", fontSize: 16, fontWeight: "700" },
});
