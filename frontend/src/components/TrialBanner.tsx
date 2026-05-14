import React from "react";

type TrialBannerProps = {
  daysLeft: number;
  onUpgrade: () => void;
};

export default function TrialBanner({
  daysLeft,
  onUpgrade,
}: TrialBannerProps) {
  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
        border: "1px solid #93c5fd",
        borderRadius: "14px",
        padding: "16px 20px",
        marginBottom: "22px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#1e3a8a",
            marginBottom: "4px",
          }}
        >
          🚀 Business-Testphase aktiv
        </div>

        <div
          style={{
            fontSize: "14px",
            color: "#334155",
          }}
        >
          Ihre Testphase endet in{" "}
          <strong>{daysLeft} Tagen</strong>.
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={onUpgrade}
      >
        Jetzt upgraden
      </button>
    </div>
  );
}