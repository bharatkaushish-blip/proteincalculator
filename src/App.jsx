import "./App.css";
import ProteinCalculator from "./ProteinCalculator";

export default function App() {
  return (
    <div className="page">
      {/* soft header wash */}
      <div className="header-wash" />

      <section className="hero">
        <h1 className="hero-title">Protein Calculator – How Much Protein Do You Need?</h1>
        <p className="hero-subtitle">
          A clean, science-based way to find your exact daily protein target using your weight, height,
          age and activity level. Fast results, no fluff.
        </p>
      </section>

      {/* your existing calculator (already styled) */}
      <ProteinCalculator />
    </div>
  );
}
