import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ModulePageDefinition } from "./module-pages";
import type { DemoFormField, DemoFormProfile } from "./demo-form-profiles";

interface DemoFormPreviewProps {
  page: ModulePageDefinition & { group: string };
  profile: DemoFormProfile;
}

function createSchema(fields: DemoFormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (field.kind === "file") continue;

    let validator = z.string();
    if (field.required) {
      validator = validator.trim().min(1, `${field.label} is required.`);
    }

    if (field.kind === "email") {
      validator = validator.email("Enter a valid example email address.");
    } else if (field.kind === "date") {
      validator = validator.regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Use the YYYY-MM-DD date format.",
      );
    } else if (field.kind === "number") {
      validator = validator.regex(
        /^[1-9]\d*$/,
        "Enter a whole number greater than zero.",
      );
    } else if (field.kind === "select" && field.options) {
      validator = validator.refine(
        (value) => !value || field.options?.includes(value),
        "Choose one of the listed options.",
      );
    }

    shape[field.id] = field.required
      ? validator
      : z.union([z.literal(""), validator.optional()]);
  }

  return z.object(shape);
}

function sampleDefaults(fields: DemoFormField[]): Record<string, string> {
  return Object.fromEntries(
    fields
      .filter((field) => field.kind !== "file")
      .map((field) => [field.id, field.sampleValue]),
  );
}

export function DemoFormPreview({ page, profile }: DemoFormPreviewProps) {
  const defaults = useMemo(() => sampleDefaults(profile.fields), [profile]);
  const schema = useMemo(() => createSchema(profile.fields), [profile]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const {
    handleSubmit,
    register,
    reset,
    formState: { isSubmitting },
  } = useForm<Record<string, string>>({
    defaultValues: defaults,
  });
  const sections = [...new Set(profile.fields.map((field) => field.section))];

  function validatePreview(values: Record<string, string>) {
    const result = schema.safeParse(values);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const fieldId = issue.path[0];
        if (typeof fieldId === "string" && !nextErrors[fieldId]) {
          nextErrors[fieldId] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setFeedback("Review the highlighted fields in this local form preview.");
      return;
    }

    setFieldErrors({});
    setFeedback(
      "Local format checks passed. Nothing was submitted, saved, or sent.",
    );
  }

  function renderField(field: DemoFormField) {
    const error = fieldErrors[field.id];
    const describedBy = [
      field.helpText ? `${field.id}-help` : "",
      error ? `${field.id}-error` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const commonProps = {
      id: field.id,
      disabled: field.disabled,
      required: field.required,
      "aria-invalid": Boolean(error),
      "aria-describedby": describedBy || undefined,
    };

    return (
      <div className="demo-form-field" key={field.id}>
        <label htmlFor={field.id}>
          {field.label}
          {field.required && <span aria-hidden="true"> *</span>}
        </label>
        {field.kind === "select" ? (
          <select {...commonProps} {...register(field.id)}>
            <option value="">Choose {field.label.toLocaleLowerCase()}</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.kind === "textarea" ? (
          <textarea rows={4} {...commonProps} {...register(field.id)} />
        ) : field.kind === "file" ? (
          <input type="file" {...commonProps} />
        ) : (
          <input type={field.kind} {...commonProps} {...register(field.id)} />
        )}
        {field.helpText && (
          <small id={`${field.id}-help`}>{field.helpText}</small>
        )}
        {error && (
          <span className="field-error" id={`${field.id}-error`} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <section className="demo-form-page">
      <nav className="record-breadcrumbs" aria-label="Breadcrumb">
        <Link
          params={{ moduleId: page.id }}
          search={{ demo: true }}
          to="/modules/$moduleId"
        >
          {page.group}
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          params={{ moduleId: page.id }}
          search={{ demo: true }}
          to="/modules/$moduleId"
        >
          {page.title}
        </Link>
        <span aria-hidden="true">/</span>
        <span>Form preview</span>
      </nav>

      <header className="demo-form-header">
        <div>
          <p className="eyebrow">{page.group}</p>
          <h1>{profile.title}</h1>
          <p className="page-description">{profile.description}</p>
        </div>
        <span className="demo-only-badge">Illustrative form</span>
      </header>

      <aside className="demo-data-banner" role="note">
        <span className="demo-banner-mark" aria-hidden="true">
          DEMO
        </span>
        <div>
          <strong>
            Sample values are fictional and prefilled for layout review
          </strong>
          <p>
            You can edit fields and check local format validation. Nothing is
            sent to the server or saved to application records.
          </p>
        </div>
      </aside>

      <div className="demo-form-layout">
        <form
          className="demo-form-card"
          noValidate
          onSubmit={handleSubmit(validatePreview)}
        >
          {sections.map((section) => (
            <section className="demo-form-section" key={section}>
              <div className="demo-form-section-heading">
                <h2>{section}</h2>
                <span>Example values</span>
              </div>
              <div className="demo-form-grid">
                {profile.fields
                  .filter((field) => field.section === section)
                  .map(renderField)}
              </div>
            </section>
          ))}

          {feedback && (
            <p
              className={
                feedback.startsWith("Local")
                  ? "demo-form-feedback"
                  : "form-error"
              }
              role={feedback.startsWith("Local") ? "status" : "alert"}
            >
              {feedback}
            </p>
          )}

          <div className="demo-form-actions">
            <button className="button" disabled={isSubmitting} type="submit">
              Validate sample form
            </button>
            <button
              className="button button-secondary"
              disabled={isSubmitting}
              onClick={() => {
                reset(defaults);
                setFieldErrors({});
                setFeedback(null);
              }}
              type="button"
            >
              Reset examples
            </button>
            <Link
              className="module-back-link"
              params={{ moduleId: page.id }}
              search={{ demo: true }}
              to="/modules/$moduleId"
            >
              Back to {page.title}
            </Link>
          </div>
        </form>

        <aside className="demo-form-rail">
          <section className="record-rail-card">
            <h2>Preview checklist</h2>
            <ul>
              <li>Fields and example values are feature-specific.</li>
              <li>Required fields are marked in the form.</li>
              <li>Validation is local and does not create a record.</li>
            </ul>
          </section>
          <section className="record-rail-card">
            <h2>Feature notes</h2>
            <p>{profile.note}</p>
          </section>
          <section className="record-rail-card">
            <h2>Backend phase</h2>
            <p>
              API contracts, permissions, workflow rules, and persistence will
              replace this form preview later.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
