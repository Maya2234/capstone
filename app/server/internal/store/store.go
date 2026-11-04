// Package store is the Card/Payment Information Store (I4).
package store

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schema string

var ErrNotFound = errors.New("not found")

type Store struct {
	DB  *sql.DB
	gcm cipher.AEAD
}

// Open opens (or creates) the SQLite database and applies the schema.
// tokenKey must be 32 bytes; it encrypts processor tokens at rest (NFR-04).
func Open(path string, tokenKey []byte) (*Store, error) {
	db, err := sql.Open("sqlite", fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", path))
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // SQLite allows one writer; serializing keeps it simple.
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	block, err := aes.NewCipher(tokenKey)
	if err != nil {
		return nil, fmt.Errorf("token key: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Store{DB: db, gcm: gcm}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

func NewID() string {
	var b [16]byte
	if _, err := io.ReadFull(rand.Reader, b[:]); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	h := hex.EncodeToString(b[:])
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:32]
}

func Now() string                  { return time.Now().UTC().Format(time.RFC3339Nano) }
func ParseTime(s string) time.Time { t, _ := time.Parse(time.RFC3339Nano, s); return t }

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Seal encrypts a processor token with AES-256-GCM.
func (s *Store) Seal(plain string) []byte {
	nonce := make([]byte, s.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		panic(err)
	}
	return s.gcm.Seal(nonce, nonce, []byte(plain), nil)
}

func (s *Store) Unseal(sealed []byte) (string, error) {
	n := s.gcm.NonceSize()
	if len(sealed) < n {
		return "", errors.New("sealed token too short")
	}
	plain, err := s.gcm.Open(nil, sealed[:n], sealed[n:], nil)
	return string(plain), err
}

// ---- users and sessions -------------------------------------------------

type User struct {
	ID, Email, Name string
}

func (s *Store) UpsertUser(ctx context.Context, email, googleSub, name string) (User, error) {
	var u User
	err := s.DB.QueryRowContext(ctx, `SELECT id, email, COALESCE(name,'') FROM user WHERE email = ?`, email).Scan(&u.ID, &u.Email, &u.Name)
	if err == nil {
		return u, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return u, err
	}
	u = User{ID: NewID(), Email: email, Name: name}
	var sub any
	if googleSub != "" {
		sub = googleSub
	}
	_, err = s.DB.ExecContext(ctx, `INSERT INTO user (id, email, google_sub, name, created_at) VALUES (?,?,?,?,?)`, u.ID, email, sub, name, Now())
	return u, err
}

func (s *Store) UserByID(ctx context.Context, id string) (User, error) {
	var u User
	err := s.DB.QueryRowContext(ctx, `SELECT id, email, COALESCE(name,'') FROM user WHERE id = ?`, id).Scan(&u.ID, &u.Email, &u.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

func (s *Store) CreateSession(ctx context.Context, userID, token string, ttl time.Duration) (time.Time, error) {
	exp := time.Now().UTC().Add(ttl)
	_, err := s.DB.ExecContext(ctx, `INSERT INTO session (token_hash, user_id, expires_at) VALUES (?,?,?)`,
		HashToken(token), userID, exp.Format(time.RFC3339Nano))
	return exp, err
}

// TouchSession returns the session's user and slides the expiry forward,
// so a session expires after ttl of inactivity (NFR-05).
func (s *Store) TouchSession(ctx context.Context, token string, ttl time.Duration) (string, error) {
	var userID, exp string
	h := HashToken(token)
	err := s.DB.QueryRowContext(ctx, `SELECT user_id, expires_at FROM session WHERE token_hash = ?`, h).Scan(&userID, &exp)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if time.Now().UTC().After(ParseTime(exp)) {
		s.DB.ExecContext(ctx, `DELETE FROM session WHERE token_hash = ?`, h)
		return "", ErrNotFound
	}
	_, err = s.DB.ExecContext(ctx, `UPDATE session SET expires_at = ? WHERE token_hash = ?`,
		time.Now().UTC().Add(ttl).Format(time.RFC3339Nano), h)
	return userID, err
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.DB.ExecContext(ctx, `DELETE FROM session WHERE token_hash = ?`, HashToken(token))
	return err
}

// ---- cards ---------------------------------------------------------------

type UserCard struct {
	ID               string   `json:"cardId"`
	UserID           string   `json:"-"`
	InstitutionID    string   `json:"-"`
	Institution      string   `json:"institution"`
	ProductID        string   `json:"productId"`
	Last4            string   `json:"last4"`
	Network          string   `json:"network"`
	Nickname         string   `json:"nickname"`
	Preferred        bool     `json:"preferred"`
	Status           string   `json:"status"`
	ExpiresAt        string   `json:"expiresAt,omitempty"`
	CreditLimitCents int64    `json:"creditLimitCents"`
	BalanceCents     int64    `json:"balanceCents"`
	Choices          []string `json:"choices"`
	RotatingActive   []string `json:"rotatingActive"`
	CreatedAt        string   `json:"createdAt"`
	ProcessorToken   []byte   `json:"-"`
}

const cardCols = `c.id, c.user_id, c.card_product_id, c.last4, c.network, COALESCE(c.nickname,''), c.preferred, c.status,
	COALESCE(c.expires_at,''), c.credit_limit_cents, c.balance_cents, c.choices, c.rotating_active, c.created_at, c.processor_token, l.institution`

func scanCard(row interface{ Scan(...any) error }) (UserCard, error) {
	var c UserCard
	var pref int
	var choices, rot string
	err := row.Scan(&c.ID, &c.UserID, &c.ProductID, &c.Last4, &c.Network, &c.Nickname, &pref, &c.Status, &c.ExpiresAt,
		&c.CreditLimitCents, &c.BalanceCents, &choices, &rot, &c.CreatedAt, &c.ProcessorToken, &c.Institution)
	if err != nil {
		return c, err
	}
	c.Preferred = pref == 1
	json.Unmarshal([]byte(choices), &c.Choices)
	json.Unmarshal([]byte(rot), &c.RotatingActive)
	if c.Choices == nil {
		c.Choices = []string{}
	}
	if c.RotatingActive == nil {
		c.RotatingActive = []string{}
	}
	return c, nil
}

func (s *Store) Cards(ctx context.Context, userID string) ([]UserCard, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT `+cardCols+` FROM user_card c JOIN institution_link l ON l.id = c.institution_link_id
		WHERE c.user_id = ? AND c.active = 1 ORDER BY c.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []UserCard
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) Card(ctx context.Context, userID, cardID string) (UserCard, error) {
	c, err := scanCard(s.DB.QueryRowContext(ctx, `SELECT `+cardCols+` FROM user_card c JOIN institution_link l ON l.id = c.institution_link_id
		WHERE c.user_id = ? AND c.id = ? AND c.active = 1`, userID, cardID))
	if errors.Is(err, sql.ErrNoRows) {
		return c, ErrNotFound
	}
	return c, err
}

func (s *Store) SetPreferred(ctx context.Context, userID, cardID string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, `UPDATE user_card SET preferred = 1 WHERE user_id = ? AND id = ? AND active = 1`, userID, cardID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	if _, err := tx.ExecContext(ctx, `UPDATE user_card SET preferred = 0 WHERE user_id = ? AND id <> ?`, userID, cardID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) RemoveCard(ctx context.Context, userID, cardID string) error {
	res, err := s.DB.ExecContext(ctx, `UPDATE user_card SET active = 0, preferred = 0 WHERE user_id = ? AND id = ? AND active = 1`, userID, cardID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) UpdateCardSettings(ctx context.Context, userID, cardID string, choices, rotating []string, status string) error {
	cj, _ := json.Marshal(nonNil(choices))
	rj, _ := json.Marshal(nonNil(rotating))
	res, err := s.DB.ExecContext(ctx, `UPDATE user_card SET choices = ?, rotating_active = ?, status = ? WHERE user_id = ? AND id = ? AND active = 1`,
		string(cj), string(rj), status, userID, cardID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// SpentThisPeriod sums the user's succeeded CardStack spend on a card since a time,
// used to apply reward caps.
func (s *Store) SpentSince(ctx context.Context, cardID string, since time.Time) (int64, error) {
	var total sql.NullInt64
	err := s.DB.QueryRowContext(ctx, `SELECT SUM(amount_cents) FROM "transaction" WHERE card_id = ? AND state = 'SUCCEEDED' AND created_at >= ?`,
		cardID, since.UTC().Format(time.RFC3339Nano)).Scan(&total)
	return total.Int64, err
}
