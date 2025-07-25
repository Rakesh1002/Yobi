#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Cleaning up ports for Yobi Trading Platform...${NC}\n"

# Define the ports used by different services
PORTS=(
    3000  # Frontend (Next.js)
    3002  # API Gateway  
    3004  # Data Collector
    3009  # Background Agent
    5432  # PostgreSQL (if running locally)
    6379  # Redis (if running locally)
    8080  # SearXNG
)

# Function to kill process on a specific port
kill_port() {
    local port=$1
    echo -e "${YELLOW}Checking port ${port}...${NC}"
    
    # Find processes using the port
    local pids=$(lsof -ti:$port 2>/dev/null)
    
    if [ -z "$pids" ]; then
        echo -e "${GREEN}✅ Port ${port} is already free${NC}"
    else
        echo -e "${RED}🔸 Found processes on port ${port}: ${pids}${NC}"
        
        # Kill the processes
        for pid in $pids; do
            echo -e "${YELLOW}  Killing process ${pid}...${NC}"
            kill -9 $pid 2>/dev/null
            
            # Verify the process was killed
            if kill -0 $pid 2>/dev/null; then
                echo -e "${RED}  ❌ Failed to kill process ${pid}${NC}"
            else
                echo -e "${GREEN}  ✅ Successfully killed process ${pid}${NC}"
            fi
        done
        
        # Double check the port is now free
        sleep 1
        local remaining_pids=$(lsof -ti:$port 2>/dev/null)
        if [ -z "$remaining_pids" ]; then
            echo -e "${GREEN}✅ Port ${port} is now free${NC}"
        else
            echo -e "${RED}❌ Port ${port} still has processes: ${remaining_pids}${NC}"
        fi
    fi
    echo ""
}

# Kill processes on all required ports
for port in "${PORTS[@]}"; do
    kill_port $port
done

# Also kill any node processes that might be lingering
echo -e "${YELLOW}🔍 Checking for lingering Node.js processes...${NC}"
node_pids=$(pgrep -f "node.*ts-node\|node.*next\|node.*turbo" 2>/dev/null)

if [ -n "$node_pids" ]; then
    echo -e "${RED}Found lingering Node.js processes: ${node_pids}${NC}"
    for pid in $node_pids; do
        echo -e "${YELLOW}  Killing Node.js process ${pid}...${NC}"
        kill -9 $pid 2>/dev/null
    done
    sleep 2
    echo -e "${GREEN}✅ Cleaned up Node.js processes${NC}"
else
    echo -e "${GREEN}✅ No lingering Node.js processes found${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Port cleanup completed!${NC}"
echo -e "${BLUE}📋 Port assignments:${NC}"
echo -e "  • ${GREEN}3000${NC} - Frontend (Next.js)"
echo -e "  • ${GREEN}3002${NC} - API Gateway" 
echo -e "  • ${GREEN}3004${NC} - Data Collector"
echo -e "  • ${GREEN}3009${NC} - Background Agent"
echo -e "  • ${GREEN}8080${NC} - SearXNG"
echo ""
echo -e "${BLUE}Ready to start development environment! 🚀${NC}" 