# -----------------------------------------------------------------------------
# Cloud Run Job - Database Migrations
# -----------------------------------------------------------------------------
# Runs dbmate migrations before service deployments
# Triggered by CI/CD pipeline with `gcloud run jobs execute --wait`

# Service account for migrations
resource "google_service_account" "migrations" {
  account_id   = "migrations-service"
  display_name = "Database Migrations Service"
}

# Grant Cloud SQL client access to migrations service account
resource "google_project_iam_member" "migrations_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.migrations.email}"
}

# Grant access to db-password secret
resource "google_secret_manager_secret_iam_member" "migrations_db" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.migrations.email}"
}

# Cloud Run Job for migrations
resource "google_cloud_run_v2_job" "migrations" {
  name     = "${var.project}-migrations"
  location = var.region

  template {
    template {
      service_account = google_service_account.migrations.email
      timeout         = "300s"

      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/migrations:latest"

        # DB connection components - entrypoint.sh constructs DATABASE_URL
        env {
          name  = "DB_HOST"
          value = "/cloudsql/${google_sql_database_instance.main.connection_name}"
        }
        env {
          name  = "DB_NAME"
          value = "habitcraft"
        }
        env {
          name  = "DB_USER"
          value = "habitcraft"
        }
        env {
          name = "DB_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_password.secret_id
              version = "latest"
            }
          }
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  # Ensure IAM bindings exist before creating the job
  # (Cloud Run validates secret access at creation time)
  depends_on = [
    google_secret_manager_secret_iam_member.migrations_db,
    google_project_iam_member.migrations_cloudsql,
  ]
}
