import json, random
from datetime import date, timedelta

random.seed(42)

STATES = ["CA","TX","FL","NY","IL","OH","PA","MI","GA","NC","AZ","WA","CO","MN","WI"]
COLD_STATES = {"NY","IL","OH","PA","MI","MN","WI","CO","WA"}
PRODUCTS = ["Price Sync LTE","Price Sync NET"]

def rid(n): return "SVC-{:04d}".format(n)
def site(): return "{}-{:04d}".format(random.choice(STATES), random.randint(1,999))
def rdate():
    start = date(2018,1,1); end = date(2024,12,1)
    return (start + timedelta(days=random.randint(0,(end-start).days))).isoformat()
def jitter(v, d): return round(v + random.uniform(-d, d), 1)
def nominal_12v(): return round(random.uniform(11.6, 12.4), 1)

def abbr(note):
    if random.random() < 0.3:
        repl = {"voltage":"V","Voltage":"V","replaced":"rplcd","swapped":"swpd",
                "connector":"connex","conduit":"cnduit","module":"mod","Regular":"Reg",
                "Diesel":"Dsl","Premium":"Prem","confirmed":"confrmd","adjacent":"adj"}
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

records = []

def mode_psu():
    d = rdate(); s = site(); st_ = s[:2]
    age = random.randint(14, 34); panels = random.choice([2,3,4])
    notes = random.choice([
        "All panels dark. PCU shows solid green. 12V rail at 0V confirmed with meter. Swapped PSU from adjacent sign - all panels came back immediately. Ordered replacement.",
        "Sign completely dark on arrival. Controller still powered, 12V supply reads 0. Pulled PSU from spare unit, display lit right up. PSU dead.",
        "12V at 0, PSU dead. 5V logic still good so PCU online. Replaced power supply, all price panels restored.",
        "No display. Measured 0V on 12V rail, 5.1V on logic. Confirmed PSU failure by swap test with neighboring sign.",
    ])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": age, "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": 0.0, "voltage_5v_logic": jitter(5.0, 0.2),
        "controller_status": "active", "rs485_response": False,
        "price_panels_lit": 0, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(2, 30), "lte_signal_present": True,
        "error_codes": ["PSU_FAIL","DISPLAY_NO_RESP"], "technician_notes": abbr(notes),
        "root_cause": "Power supply failure - 12V DC rail collapsed",
        "component_failed": "Power Supply Unit", "part_number": "ABLE-PSU-12V-150W",
        "rma_required": True, "resolution_time_hours": round(random.uniform(0.5,1.5),1),
        "warranty_covered": age <= 36}

def mode_module():
    d = rdate(); s = site(); st_ = s[:2]
    panels = random.choice([3,4]); lit = panels - 1
    which = random.choice(["Regular","Diesel","Premium"])
    notes = random.choice([
        "{} panel dark, others fine. 12V nominal at 12.1. RS-485 responding. Swapped digit module, panel restored.".format(which),
        "{} digits out. All voltages good, comms up. Replaced 8in digit module.".format(which),
        "One panel ({}) not lighting. Confirmed module fault - adjacent panels normal. Module swapped.".format(which),
    ])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(8, 50), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": lit, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(1,12), "lte_signal_present": True,
        "error_codes": ["MODULE_FAIL"], "technician_notes": abbr(notes),
        "root_cause": "Digit module failure - {} price panel".format(which),
        "component_failed": "Digit Display Module", "part_number": "ABLE-DGT-MOD-8IN",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.0),1),
        "warranty_covered": random.random()<0.5}

def mode_cable():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    notes = random.choice([
        "Flickering at night, worse in cold. Reseated RS-485 connector at PCU. Cable chafed at conduit entry - replaced run.",
        "Intermittent dropouts after heavy rain. RS-485 connection loose at conduit. Replaced cable.",
        "Panels drop out randomly. Voltages all nominal. Found RS-485 connex loose at cnduit, re-terminated.",
        "Display flickers in cold weather. Comms intermittent. Reseated and replaced chafed RS-485 cable.",
    ])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(12,48), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": random.choice([True, False]),
        "price_panels_lit": random.choice([panels-1, panels, 1]), "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(1,20), "lte_signal_present": True,
        "error_codes": ["COMM_INTERMITTENT"], "technician_notes": abbr(notes),
        "root_cause": "RS-485 cable/connector fault - intermittent communication",
        "component_failed": "RS-485 Cable", "part_number": "ABLE-CBL-RS485-10FT",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.5),1),
        "warranty_covered": random.random()<0.4}

def mode_pcu():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    notes = random.choice([
        "Price not updating from POS. Sign shows stale price. POS sending but sign stuck. PCU comm board replaced.",
        "Display lit with correct old price but will not take updates. RS-485 present, PCU not transmitting. Replaced PCU board.",
        "Sign stuck on prior price. POS confirmed sending. PCU TX fault - swapped comm board, updates flowing.",
    ])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(10,46), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": panels, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(18, 96), "lte_signal_present": True,
        "error_codes": ["PCU_TX_FAIL"], "technician_notes": abbr(notes),
        "root_cause": "PCU comm board failure - price updates not transmitting",
        "component_failed": "PCU Comm Board", "part_number": "ABLE-PCU-COMMBD",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.5),1),
        "warranty_covered": random.random()<0.5}

def mode_degrade():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    notes = random.choice([
        "Barely visible in sun. No errors. 3+ years outdoor exposure, UV degraded LEDs. Recommended digit module refresh.",
        "Dim display, hard to read daytime. Voltages nominal, no faults. Aged LEDs - replaced module.",
        "Customer complaint of dim sign. All readings normal. 4yr unit, sun-faded digits. Module swap.",
    ])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(42,60), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": panels, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(1,12), "lte_signal_present": True,
        "error_codes": [], "technician_notes": abbr(notes),
        "root_cause": "LED digit degradation - UV/age dimming",
        "component_failed": "Digit Display Module", "part_number": "ABLE-DGT-MOD-8IN",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,1.0),1),
        "warranty_covered": False}

def mode_fw():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    ec = random.choice(["FW_CORRUPT","CONFIG_ERR"])
    notes = random.choice([
        "Wrong prices showing after PCU firmware update. Garbled digits. Factory reset and reflashed firmware - restored.",
        "Garbled after update. Reflashed PCU firmware, prices correct.",
        "Sign showing wrong prices after POS change. Config corrupt. Reflashed and reconfigured.",
    ])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(6,48), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": random.choice([panels, panels-1]), "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(1,24), "lte_signal_present": True,
        "error_codes": [ec], "technician_notes": abbr(notes),
        "root_cause": "Firmware/config corruption after update",
        "component_failed": "PCU Firmware",
        "part_number": "" if random.random()<0.7 else "ABLE-PCU-COMMBD",
        "rma_required": False, "resolution_time_hours": round(random.uniform(0.5,2.0),1),
        "warranty_covered": True}

def mode_surge():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    notes = random.choice([
        "Lightning strike nearby overnight. Surge protector blown. Multiple boards replaced - PSU and two digit modules.",
        "Storm damage. Multiple rails affected, several error codes. Replaced PSU + digit modules. Surge arrestor added.",
        "Power surge after grid event. PSU and modules fried. Multi-board replacement.",
    ])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(8,52), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": random.choice([0.0, jitter(8.0,2.0)]),
        "voltage_5v_logic": random.choice([0.0, jitter(4.2,0.5)]),
        "controller_status": random.choice(["fault","active"]), "rs485_response": False,
        "price_panels_lit": 0, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(2,48),
        "lte_signal_present": random.choice([True, False]),
        "error_codes": ["SURGE_DETECT","PSU_FAIL","MODULE_FAIL"], "technician_notes": abbr(notes),
        "root_cause": "Power surge / lightning damage - multiple components",
        "component_failed": "Power Supply Unit + Digit Modules",
        "part_number": "ABLE-PSU-12V-150W + ABLE-DGT-MOD-8IN",
        "rma_required": True, "resolution_time_hours": round(random.uniform(1.5,4.0),1),
        "warranty_covered": False}

def mode_pos():
    d = rdate(); s = site(); st_ = s[:2]; panels = random.choice([3,4])
    notes = random.choice([
        "POS updated, wrong IP in PCU. No hardware fault. Reconfigured network settings, updates flowing.",
        "Sign not updating after site network upgrade. Wrong IP. Reconfigured PCU, no parts needed.",
        "No hardware issue. POS misconfig after upgrade. Fixed IP settings in PCU.",
    ])
    return {"date": d, "site_id": s, "product": random.choice(PRODUCTS),
        "unit_age_months": random.randint(6,48), "ambient_temp_f": temp_for(d, st_),
        "voltage_12v_rail": nominal_12v(), "voltage_5v_logic": jitter(5.0,0.15),
        "controller_status": "active", "rs485_response": True,
        "price_panels_lit": panels, "total_price_panels": panels,
        "hours_since_last_price_update": random.randint(24,120), "lte_signal_present": True,
        "error_codes": [], "technician_notes": abbr(notes),
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
    r["ticket_id"] = rid(i)
    # reorder so ticket_id is first key
    records[i-1] = {"ticket_id": r.pop("ticket_id"), **r}

with open("C:/Users/ateeq/BoaSteering/app/public/knowledge-base.json","w") as f:
    json.dump(records, f, indent=1)

from collections import Counter
print("Wrote", len(records), "records")
print(Counter(r["component_failed"] for r in records))
