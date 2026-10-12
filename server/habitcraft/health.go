package habitcraft

import (
	"context"
	"time"

	"github.com/adamwolfers/habitcraft/server/api"
)

// The service name and version the Node backend reports, kept so a load
// balancer or smoke check reading /health sees no difference at cutover.
const (
	serviceName    = "habittracker-api"
	serviceVersion = "1.0.0"
)

// healthTimeout bounds the database probe, so a database that hangs rather
// than refusing still gets a prompt 503 instead of a stalled health check.
const healthTimeout = 2 * time.Second

// HealthCheck reports liveness and whether the database answers. An
// unreachable database is a 503 with the same shape, not an error body.
func (s *Server) HealthCheck(ctx context.Context, _ api.HealthCheckRequestObject) (api.HealthCheckResponseObject, error) {
	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(ctx, healthTimeout)
	defer cancel()
	if err := s.db.Ping(ctx); err != nil {
		return api.HealthCheck503JSONResponse{
			Service:   serviceName,
			Version:   serviceVersion,
			Status:    api.Unhealthy,
			Timestamp: now,
			Database:  api.Disconnected,
			Error:     err.Error(),
		}, nil
	}
	return api.HealthCheck200JSONResponse{
		Service:   serviceName,
		Version:   serviceVersion,
		Status:    api.Healthy,
		Timestamp: now,
		Database:  api.Connected,
	}, nil
}

// HelloWorld is the smoke-test endpoint.
func (s *Server) HelloWorld(context.Context, api.HelloWorldRequestObject) (api.HelloWorldResponseObject, error) {
	return api.HelloWorld200JSONResponse{Message: "Hello World!"}, nil
}
