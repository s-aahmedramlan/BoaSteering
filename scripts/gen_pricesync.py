import json, random
from datetime import date, timedelta

random.seed(7)

STATES = ["CA","TX","FL","NY","IL","OH","PA","MI","GA","NC","AZ","WA","CO","MN","WI"]
COLD_STATES = {"NY","IL","OH","PA","MI","MN","WI","CO","WA"}
PRODUCTS = ["Price Sync LTE","Price Sync NET"]
INITIALS = ["J.R.","M.T.","D.K.","A.P.","R.S.","L.M.","C.B.","T.W.","E.G.","B.N.","S.H.","K.D."]

def rid(n): return "SVC-{:04d}".format(n)
def site(): return "{}-{:04d}".format(random.choice(STATES), random.randint(1,999))
def rdate():
    start = date(2018,1,1); end = date(2024,12,1)
    return (start + timedelta(days=random.randint(0,(end-start).days))).isoformat()
def jitter(v, d): return round(v + random.uniform(-d, d), 1)
def nominal_12v(): return round(random.uniform(11.6, 12.4), 1)
def tech(): return random.choice(INITIALS)

def abbr(note):
    if random.random() < 0.25:
        repl = {"voltage":"V","replaced":"rplcd","swapped":"swpd","connector":"connex",
                "conduit":"cnduit","module":"mod","Regular":"Reg","Diesel":"Dsl",
                "Premium":"Prem","confirmed":"confrmd","adjacent":"adj","measured":"msrd"}
        for k,v in repl.items():
            note = note.replace(k,v)
    return note

def temp_for(d_iso, st):
    m = int(d_iso[5:7])
    if st in COLD_STATES:
        base = {12:28,1:24,2:30,3:42,4:54,11:40}.get(m, 66)
    else:
        base = {12:52,1:48,2:54,3:64,4:72,11:58}.get(m, 82)
    return base + random.randint(-8,8)

# Optional short trailing detail to make every note read uniquely
def flavor(pool):
    bits = []
    if random.random() < 0.55: bits.append(random.choice(pool))
    if random.random() < 0.35: bits.append(f"Tech {tech()}.")
    return (" " + " ".join(bits)) if bits else ""

records = []

# ─── MODE 1: PSU failure ───
PSU_NOTES = [
    "All panels dark on arrival. PCU shows solid green. 12V rail measured 0V at the supply terminals. Swapped PSU from the adjacent sign and all panels came right back.",
    "Sign completely dark. Controller still powered off the 5V logic, but 12V supply reads zero. Pulled the PSU from a spare unit, display lit immediately.",
    "12V at 0, PSU dead. 5V logic still good so the PCU stayed online. Replaced the power supply and all price panels restored.",
    "No display at all. Meter showed 0V on the 12V rail, 5.1V on logic. Confirmed PSU failure with a swap test against the neighboring sign.",
    "Got the dark-sign call this morning. AC input present at the PSU, but no 12V out. Classic supply failure. Ordered replacement.",
    "Owner reported sign went dark overnight. PCU green, panels dead. 12V rail collapsed to nothing. PSU swap confirmed it.",
    "Display down. Checked breaker first, fine. PSU output flatlined at 0V with good AC in. Power supply is the failure.",
    "Whole board dark. 5V healthy, 12V gone. Bench-tested the suspect PSU back at the shop, would not hold output. Replaced on site.",
    "Sign black. Verified mains, verified logic rail at 5.0V, 12V at zero. Supply failed. Pulled and tagged for return.",
    "Three calls this week, same site. Sign dark, 12V rail dead, PSU not recovering on power cycle. Swapped supply, back up.",
    "Panels all out. PCU booting normally on 5V. No 12V whatsoever. Temporary PSU from the truck brought it back instantly.",
    "Dark display reported by route driver. Confirmed 0V on the main rail, supply not switching. New PSU installed and verified.",
]
PSU_FLAVOR = ["Caps looked bulged.", "No visible burn marks.", "Unit ran hot.", "AC confirmed at input.",
              "Cycled power twice, no recovery.", "Sign back to full brightness after swap.", "Logged for warranty review."]

def mode_psu():
    d = rdate(); s = site(); st_ = s[:2]
    age = random.randint(14, 34); panels = random.choice([2,3,4])
    v12 = random.choice([0.0, 0.0, 0.0, 0.1, 0.2])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": age, "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": v12, "voltage_5v_logic": jitter(5.0, 0.2),
        "controller_status": "active", "rs485_response": False,
        "price_panels_lit": 0, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(2, 30), "lte_signal_present": True,
        "error_codes": ["PSU_FAIL","DISPLAY_NO_RESP"],
        "technician_notes": abbr(random.choice(PSU_NOTES) + flavor(PSU_FLAVOR)),
        "root_cause": "Power supply failure - 12V DC rail collapsed",
        "component_failed": "Power Supply Unit", "part_number": "ABLE-PSU-12V-150W",
        "rma_required": True, "resolution_time_hours": round(random.uniform(0.5,1.5),1),
        "warranty_covered": age <= 36}

# ─── MODE 2: digit module ───
MOD_NOTES = [
    "{p} panel dark, the others fine. 12V nominal at {v}. RS-485 responding. Swapped the digit module and the panel restored.",
    "{p} digits out completely. All voltages good, comms up. Replaced the 8in digit module.",
    "Only the {p} panel won't light. Confirmed a module fault, adjacent panels normal. Module swapped.",
    "{p} price stuck blank while the rest of the board reads fine. Rail nominal at {v}. Pulled and replaced the bad module.",
    "Customer noticed {p} panel was out. Probed the module, no response on its segment. New module fixed it.",
    "Half the {p} digits dead, half flickering. Module-level failure. Swapped it out, verified all segments.",
    "{p} panel showing partial digits. 12V fine at {v}, comms good. Faulty digit module replaced.",
    "Got a call that {p} wasn't displaying. Everything upstream checked out. Replaced the module on the {p} panel.",
    "{p} board dark on arrival, no error beyond MODULE_FAIL. Voltages clean. Module swap resolved it.",
]
MOD_FLAVOR = ["Other panels unaffected.", "Quick swap, back in service.", "Old module kept for teardown.",
              "No comms issues.", "Segments verified after.", "Cold morning, no relation."]

def mode_module():
    d = rdate(); s = site(); st_ = s[:2]
    panels = random.choice([3,4]); lit = panels - 1
    which = random.choice(["Regular","Diesel","Premium"]); v = nominal_12v()
    note = random.choice(MOD_NOTES).format(p=which, v=f"{v}V") + flavor(MOD_FLAVOR)
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(8, 50), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": v, "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": lit, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(1,12), "lte_signal_present": True,
        "error_codes": ["MODULE_FAIL"], "technician_notes": abbr(note),
        "root_cause": "Digit module failure - {} price panel".format(which),
        "component_failed": "Digit Display Module", "part_number": "ABLE-DGT-MOD-8IN",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.0),1),
        "warranty_covered": random.random()<0.5}

# ─── MODE 3: RS-485 cable ───
CABLE_NOTES = [
    "Flickering at night, worse in the cold. Reseated the RS-485 connector at the PCU. Cable was chafed at the conduit entry, replaced the run.",
    "Intermittent dropouts after heavy rain. RS-485 connection loose at the conduit. Replaced the cable.",
    "Panels drop out at random. Voltages all nominal. Found the RS-485 connector loose at the conduit and re-terminated it.",
    "Display flickers in cold weather. Comms intermittent. Reseated, then replaced a chafed RS-485 cable.",
    "Sign blinks on and off, no pattern. Wiggled the harness and it dropped out, so traced it to a cracked RS-485 conductor.",
    "Route driver reported flicker. Rail steady at {v}. Comm line intermittent, corrosion on the RS-485 connector pins. Cleaned and replaced cable.",
    "On-and-off display, mostly mornings. PCU and supply both fine. RS-485 cable pinched behind the cabinet. Rerouted and replaced.",
    "Customer says it cuts out when windy. Found the comm cable rubbing on a sharp bracket edge. Replaced the section.",
    "Panels flickering, COMM_INTERMITTENT logged. Voltages clean. Loose RS-485 termination at the gateway end. Re-crimped and ran new cable.",
]
CABLE_FLAVOR = ["Weather sealed the entry after.", "Strain relief added.", "No PSU involvement.",
                "Tested 30 min, stable.", "Connector pins corroded.", "Cable jacket cracked."]

def mode_cable():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4]); v = nominal_12v()
    note = random.choice(CABLE_NOTES).format(v=f"{v}V") + flavor(CABLE_FLAVOR)
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(12,48), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": v, "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": random.choice([True, False, False]),
        "price_panels_lit": random.choice([panels-1, panels, 1]), "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(1,20), "lte_signal_present": True,
        "error_codes": ["COMM_INTERMITTENT"], "technician_notes": abbr(note),
        "root_cause": "RS-485 cable/connector fault - intermittent communication",
        "component_failed": "RS-485 Cable", "part_number": "ABLE-CBL-RS485-10FT",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.5),1),
        "warranty_covered": random.random()<0.4}

# ─── MODE 4: PCU comm board ───
PCU_NOTES = [
    "Price not updating from the POS. Sign shows the stale price. POS confirmed sending but the sign stays stuck. Replaced the PCU comm board.",
    "Display lit with the correct old price but won't take updates. RS-485 present, PCU not transmitting. Swapped the PCU board.",
    "Sign stuck on yesterday's price. POS verified sending. PCU TX fault, swapped the comm board and updates started flowing.",
    "Owner changed price at the pump, sign never followed. Hardware all nominal. PCU not pushing to the panels. New comm board fixed it.",
    "Stale pricing for two days. Confirmed POS output, confirmed RS-485 wiring. The PCU transmit side was dead. Replaced board.",
    "Sign showing last week's diesel price. Everything reads fine except the PCU isn't sending. Comm board swap resolved.",
    "Got the 'won't update' ticket. Rail and comms good, but PCU_TX_FAIL logged. Replaced the PCU comm board, verified a live update.",
    "Price desync between pump and sign. No hardware faults on the display side. Traced to a failed PCU transmitter. Board replaced.",
]
PCU_FLAVOR = ["Verified a live price push after.", "POS logs were clean.", "No display faults.",
              "Firmware was current.", "Updates confirmed flowing.", "Stale by 2 days."]

def mode_pcu():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(10,46), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": panels, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(18, 96), "lte_signal_present": True,
        "error_codes": ["PCU_TX_FAIL"], "technician_notes": abbr(random.choice(PCU_NOTES) + flavor(PCU_FLAVOR)),
        "root_cause": "PCU comm board failure - price updates not transmitting",
        "component_failed": "PCU Comm Board", "part_number": "ABLE-PCU-COMMBD",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.5),1),
        "warranty_covered": random.random()<0.5}

# ─── MODE 5: LED degradation ───
DEG_NOTES = [
    "Barely visible in direct sun. No errors logged. 3+ years of outdoor exposure, LEDs are UV-degraded. Recommended a digit module refresh.",
    "Dim display, hard to read in daylight. Voltages nominal, no faults. Aged LEDs, replaced the module.",
    "Customer complaint of a dim sign. All readings normal. 4-year unit, sun-faded digits. Module swap brought brightness back.",
    "Sign washed out at midday. Nothing electrically wrong, just old LEDs. Replaced the faded modules.",
    "Hard to read from the road now. No codes, rail fine. Long-term UV wear on the digits. Refreshed the panels.",
    "Owner says it's gotten dimmer over the year. Confirmed healthy voltages. Age-related LED fade. Module replaced.",
    "Daytime visibility poor, fine at night. That's classic LED aging. No hardware fault. Swapped the dim panel.",
    "Faded look on the Regular price especially. 5 years in the sun. LEDs degraded. Module refresh recommended and done.",
]
DEG_FLAVOR = ["Night brightness still OK.", "No error codes at all.", "Original install, never serviced.",
              "South-facing, heavy sun.", "Owner approved the refresh.", "Brightness restored after."]

def mode_degrade():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(42,60), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": panels, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(1,12), "lte_signal_present": True,
        "error_codes": [], "technician_notes": abbr(random.choice(DEG_NOTES) + flavor(DEG_FLAVOR)),
        "root_cause": "LED digit degradation - UV/age dimming",
        "component_failed": "Digit Display Module", "part_number": "ABLE-DGT-MOD-8IN",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.0),1),
        "warranty_covered": False}

# ─── MODE 6: firmware/config ───
FW_NOTES = [
    "Wrong prices showing after a PCU firmware update. Garbled digits. Factory reset and reflashed the firmware, restored.",
    "Garbled segments after the last update. Reflashed the PCU firmware and prices came back clean.",
    "Sign showing wrong prices after a POS change. Config corrupted. Reflashed and reconfigured.",
    "Scrambled digits on two panels following the OTA update. Reloaded firmware, verified the price map.",
    "Display went to nonsense characters after a remote update push. Cleared config, reflashed, all good.",
    "Prices jumbled after maintenance window. No hardware fault. Firmware reflash and a fresh config load fixed it.",
    "Random characters on the board after a config sync. Reset to factory, pushed firmware again, resolved.",
]
FW_FLAVOR = ["Hardware all nominal.", "Happened right after the update.", "No parts needed.",
             "Config backed up after.", "Verified price map.", "Reflash held on retest."]

def mode_fw():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    ec = random.choice(["FW_CORRUPT","CONFIG_ERR"])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(6,48), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": random.choice([panels, panels-1]), "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(1,24), "lte_signal_present": True,
        "error_codes": [ec], "technician_notes": abbr(random.choice(FW_NOTES) + flavor(FW_FLAVOR)),
        "root_cause": "Firmware/config corruption after update",
        "component_failed": "PCU Firmware",
        "part_number": "" if random.random()<0.7 else "ABLE-PCU-COMMBD",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,2.0),1),
        "warranty_covered": True}

# ─── MODE 7: surge ───
SURGE_NOTES = [
    "Lightning strike nearby overnight. Surge protector blown. Replaced the PSU and two digit modules.",
    "Storm damage. Multiple rails affected, several codes logged. Replaced the PSU and digit modules, added a surge arrestor.",
    "Power surge after a grid event. PSU and modules fried. Multi-board replacement.",
    "Whole sign dead after the storm rolled through. Burn marks on the supply. PSU plus two modules replaced.",
    "Took a hit during the thunderstorm. Surge wiped the supply and a couple panels. Rebuilt the affected boards.",
    "Sign dark after lightning in the area. Found scorched components across the supply and display. Replaced and added protection.",
]
SURGE_FLAVOR = ["Surge arrestor added.", "Burn marks on the board.", "Storm confirmed that night.",
                "Multiple boards gone.", "Grid event logged by utility.", "Heavy damage."]

def mode_surge():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(8,52), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": random.choice([0.0, jitter(8.0,2.0)]),
        "voltage_5v_logic": random.choice([0.0, jitter(4.2,0.5)]),
        "controller_status": random.choice(["fault","active"]), "rs485_response": False,
        "price_panels_lit": 0, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(2,48),
        "lte_signal_present": random.choice([True, False]),
        "error_codes": ["SURGE_DETECT","PSU_FAIL","MODULE_FAIL"],
        "technician_notes": abbr(random.choice(SURGE_NOTES) + flavor(SURGE_FLAVOR)),
        "root_cause": "Power surge / lightning damage - multiple components",
        "component_failed": "Power Supply Unit + Digit Modules",
        "part_number": "ABLE-PSU-12V-150W + ABLE-DGT-MOD-8IN",
        "rma_required": True, "resolution_time_hours": round(random.uniform(1.5,4.0),1),
        "warranty_covered": False}

# ─── MODE 8: POS config ───
POS_NOTES = [
    "POS updated, wrong IP in the PCU. No hardware fault. Reconfigured the network settings and updates started flowing.",
    "Sign not updating after a site network upgrade. Wrong IP. Reconfigured the PCU, no parts needed.",
    "No hardware issue at all. POS misconfigured after the upgrade. Fixed the IP settings in the PCU.",
    "New POS install, sign never linked up. Subnet mismatch. Corrected the PCU network config, prices synced.",
    "Site changed ISPs, PCU still on the old gateway. Updated the IP and the sign came back in sync.",
    "Pump prices not reaching the sign after the back-office swap. Pure config. Repointed the PCU, all good.",
]
POS_FLAVOR = ["No parts used.", "Hardware fully nominal.", "Updates verified after.", "Subnet was wrong.",
              "Site IT involved.", "Resynced on the first push."]

def mode_pos():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(6,48), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": panels, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(24,120), "lte_signal_present": True,
        "error_codes": [], "technician_notes": abbr(random.choice(POS_NOTES) + flavor(POS_FLAVOR)),
        "root_cause": "POS integration/config error - network misconfiguration",
        "component_failed": "None (configuration)", "part_number": "",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.5),1),
        "warranty_covered": True}

plan = [(mode_psu,150),(mode_module,100),(mode_cable,75),(mode_pcu,60),
        (mode_degrade,50),(mode_fw,35),(mode_surge,20),(mode_pos,10)]
for fn, count in plan:
    for _ in range(count):
        records.append(fn())

random.shuffle(records)
for i, r in enumerate(records, 1):
    records[i-1] = {"ticket_id": rid(i), **r}

with open("C:/Users/ateeq/BoaSteering/app/public/knowledge-base.json","w") as f:
    json.dump(records, f, indent=1)

from collections import Counter
notes = [r["technician_notes"] for r in records]
print("Wrote", len(records), "records")
print("Unique notes:", len(set(notes)), "of", len(notes))
print(Counter(r["component_failed"] for r in records))
