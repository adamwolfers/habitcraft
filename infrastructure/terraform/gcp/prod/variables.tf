variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project" {
  description = "Project name prefix for resource naming"
  type        = string
  default     = "habitcraft"
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "db_password" {
  description = "Password for the Cloud SQL database user"
  type        = string
  sensitive   = true
}

variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
}

variable "frontend_url" {
  description = "Frontend URL for CORS configuration"
  type        = string
  default     = "https://www.habitcraft.org"
}

variable "api_domain" {
  description = "API domain for Cloud Run domain mapping"
  type        = string
  default     = "api.habitcraft.org"
}

variable "frontend_domain" {
  description = "Frontend domain for Cloud Run domain mapping"
  type        = string
  default     = "www.habitcraft.org"
}

variable "apex_domain" {
  description = "Apex domain for Cloud Run domain mapping"
  type        = string
  default     = "habitcraft.org"
}

variable "github_repository" {
  description = "GitHub repository in owner/repo format for Workload Identity Federation"
  type        = string
  default     = "adamwolfers/habitcraft"
}
