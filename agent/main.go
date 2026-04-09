// Local Bridge Agent for MikroTik management.
// Run this binary on any machine on the same LAN as your MikroTik router.
// It connects outbound to the Render backend via WebSocket — no port forwarding needed.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	routeros "github.com/go-routeros/routeros/v3"
	"github.com/gorilla/websocket"
)

// AgentCommand matches backend/internal/mikrotik/agent_hub.go AgentCommand.
type AgentCommand struct {
	ID     string            `json:"id"`
	Op     string            `json:"op"`
	Params map[string]string `json:"params"`
}

// AgentResponse matches backend/internal/mikrotik/agent_hub.go AgentResponse.
type AgentResponse struct {
	ID    string              `json:"id"`
	OK    bool                `json:"ok"`
	Error string              `json:"error"`
	Data  []map[string]string `json:"data,omitempty"`
}

func main() {
	backendURL := getEnv("BACKEND_URL", "wss://your-app.onrender.com")
	agentSecret := getEnv("AGENT_SECRET", "changeme-agent-secret")
	mtHost := getEnv("MIKROTIK_HOST", "192.168.1.1:8728")
	mtUser := getEnv("MIKROTIK_USER", "admin")
	mtPass := getEnv("MIKROTIK_PASS", "")

	wsURL := backendURL + "/ws/agent"
	log.Printf("[Agent] Starting — backend: %s, MikroTik: %s@%s", wsURL, mtUser, mtHost)

	for {
		if err := runAgent(wsURL, agentSecret, mtHost, mtUser, mtPass); err != nil {
			log.Printf("[Agent] Disconnected: %v — reconnecting in 5s", err)
		}
		time.Sleep(5 * time.Second)
	}
}

func runAgent(wsURL, secret, mtHost, mtUser, mtPass string) error {
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("dial backend: %w", err)
	}
	defer conn.Close()

	// Authenticate with backend
	if err := conn.WriteJSON(map[string]string{"secret": secret}); err != nil {
		return fmt.Errorf("send auth: %w", err)
	}
	log.Printf("[Agent] Connected to backend, awaiting commands")

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read: %w", err)
		}

		var cmd AgentCommand
		if err := json.Unmarshal(msg, &cmd); err != nil {
			log.Printf("[Agent] Invalid command JSON: %v", err)
			continue
		}

		resp := handleCommand(cmd, mtHost, mtUser, mtPass)
		if err := conn.WriteJSON(resp); err != nil {
			return fmt.Errorf("write response: %w", err)
		}
		if !resp.OK {
			log.Printf("[Agent] Command %s (%s) failed: %s", cmd.ID, cmd.Op, resp.Error)
		}
	}
}

func handleCommand(cmd AgentCommand, mtHost, mtUser, mtPass string) AgentResponse {
	mt, err := routeros.Dial(mtHost, mtUser, mtPass)
	if err != nil {
		return AgentResponse{ID: cmd.ID, OK: false, Error: "dial mikrotik: " + err.Error()}
	}
	defer mt.Close()

	p := cmd.Params
	var data []map[string]string

	switch cmd.Op {
	case "pppoe_add":
		_, err = mt.Run("/ppp/secret/add",
			"=name="+p["username"],
			"=password="+p["password"],
			"=profile="+p["profile"],
			"=service=pppoe",
		)

	case "pppoe_disable":
		_, err = mt.Run("/ppp/secret/set", "=numbers="+p["username"], "=disabled=yes")
		if err == nil {
			kickSession(mt, p["username"])
		}

	case "pppoe_enable":
		_, err = mt.Run("/ppp/secret/set", "=numbers="+p["username"], "=disabled=no")

	case "pppoe_set_profile":
		_, err = mt.Run("/ppp/secret/set", "=numbers="+p["username"], "=profile="+p["profile"])
		if err == nil {
			kickSession(mt, p["username"])
		}

	case "pppoe_kick":
		kickSession(mt, p["username"])

	case "pppoe_delete":
		var reply *routeros.Reply
		reply, err = mt.Run("/ppp/secret/print", "?name="+p["username"], "=.proplist=.id")
		if err == nil {
			for _, re := range reply.Re {
				if id := re.Map[".id"]; id != "" {
					mt.Run("/ppp/secret/remove", "=.id="+id)
				}
			}
		}

	case "pppoe_list":
		var reply *routeros.Reply
		reply, err = mt.Run("/ppp/secret/print")
		if err == nil {
			for _, re := range reply.Re {
				data = append(data, map[string]string{
					"name":     re.Map["name"],
					"password": re.Map["password"],
					"profile":  re.Map["profile"],
					"disabled": re.Map["disabled"],
					"comment":  re.Map["comment"],
				})
			}
		}

	case "queue_create":
		var reply *routeros.Reply
		reply, err = mt.Run("/queue/simple/add",
			"=name="+p["name"],
			"=target="+p["target"]+"/32",
			"=max-limit="+p["upload"]+"/"+p["download"],
		)
		if err == nil && reply.Done != nil {
			data = []map[string]string{{"id": reply.Done.Map["ret"]}}
		}

	case "queue_disable":
		_, err = mt.Run("/queue/simple/set", "=.id="+p["id"], "=disabled=yes")

	case "queue_enable":
		_, err = mt.Run("/queue/simple/set", "=.id="+p["id"], "=disabled=no")

	case "queue_update":
		_, err = mt.Run("/queue/simple/set", "=.id="+p["id"],
			"=max-limit="+p["upload"]+"/"+p["download"])

	case "queue_delete":
		_, err = mt.Run("/queue/simple/remove", "=.id="+p["id"])

	default:
		return AgentResponse{ID: cmd.ID, OK: false, Error: "unknown operation: " + cmd.Op}
	}

	if err != nil {
		return AgentResponse{ID: cmd.ID, OK: false, Error: err.Error()}
	}
	return AgentResponse{ID: cmd.ID, OK: true, Data: data}
}

// kickSession removes the active PPPoE session for a user (forces re-dial).
func kickSession(mt *routeros.Client, username string) {
	reply, err := mt.Run("/ppp/active/print", "?name="+username, "=.proplist=.id")
	if err != nil {
		return
	}
	for _, re := range reply.Re {
		if id := re.Map[".id"]; id != "" {
			mt.Run("/ppp/active/remove", "=.id="+id)
		}
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
