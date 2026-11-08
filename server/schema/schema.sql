\restrict dbmate


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.completions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    habit_id uuid NOT NULL,
    date date NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE completions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.completions IS 'Records when habits are completed';


--
-- Name: habits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    color character varying(7) DEFAULT '#3B82F6'::character varying,
    icon character varying(10) DEFAULT '⭐'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT habits_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: TABLE habits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.habits IS 'Stores user habits to track';


--
-- Name: COLUMN habits.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.habits.color IS 'Hex color code for UI display';


--
-- Name: COLUMN habits.icon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.habits.icon IS 'Emoji or icon identifier for UI display';


--
-- Name: habit_statistics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.habit_statistics AS
 SELECT h.id AS habit_id,
    h.user_id,
    h.name,
    count(c.id) AS total_completions,
    max(c.date) AS last_completed_date,
    min(c.date) AS first_completed_date
   FROM (public.habits h
     LEFT JOIN public.completions c ON ((h.id = c.habit_id)))
  GROUP BY h.id, h.user_id, h.name;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.refresh_tokens IS 'Stores refresh token hashes for rotation and revocation';


--
-- Name: COLUMN refresh_tokens.token_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.token_hash IS 'SHA256 hash of the JWT refresh token';


--
-- Name: COLUMN refresh_tokens.revoked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.revoked IS 'Whether this token has been revoked (logout or rotation)';


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Stores user account information';


--
-- Name: completions completions_habit_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completions
    ADD CONSTRAINT completions_habit_id_date_key UNIQUE (habit_id, date);


--
-- Name: completions completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completions
    ADD CONSTRAINT completions_pkey PRIMARY KEY (id);


--
-- Name: habits habits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_completions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completions_date ON public.completions USING btree (date);


--
-- Name: idx_completions_habit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completions_habit_date ON public.completions USING btree (habit_id, date);


--
-- Name: idx_completions_habit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_completions_habit_id ON public.completions USING btree (habit_id);


--
-- Name: idx_habits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habits_status ON public.habits USING btree (status);


--
-- Name: idx_habits_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habits_user_id ON public.habits USING btree (user_id);


--
-- Name: idx_habits_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habits_user_status ON public.habits USING btree (user_id, status);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: habits update_habits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: completions completions_habit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.completions
    ADD CONSTRAINT completions_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;


--
-- Name: habits habits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20260117000000'),
    ('20260207000000'),
    ('20260813000000'),
    ('20260814000000'),
    ('20260815000000');
