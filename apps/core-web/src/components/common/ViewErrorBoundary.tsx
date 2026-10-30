"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ViewErrorBoundaryProps {
  sectionName?: string;
  resetKey?: string | number;
  children: React.ReactNode;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Isolates rendering faults within individual Control Center panels, views, drawers, or modals
 * so an unexpected runtime exception never crashes the entire application shell.
 */
export class ViewErrorBoundary extends React.Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error: unknown): ViewErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unexpected UI rendering error",
    };
  }

  override componentDidUpdate(prevProps: ViewErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: "" });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 rounded-xl border border-amber-500/30 bg-slate-900/90 text-slate-200 shadow-lg">
          <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm mb-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {this.props.sectionName
                ? `${this.props.sectionName} — Isolierter Darstellungsfehler`
                : "Isolierter Darstellungsfehler"}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono max-w-lg text-center break-all mb-4">
            {this.state.errorMessage}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ansicht neu initialisieren</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
